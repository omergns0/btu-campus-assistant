import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StorageService } from '../services/storageService';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import programsData from '../data/programs.json';

const PlanContext = createContext(null);

// Kayıtlı dersin saatlerini güncel program verisinden yeniden üretir
function withSlots(course) {
  const prog = programsData[course.programKey];
  const slots = prog
    ? (prog.courses || []).filter(s => s.code === course.code && s.section === course.section && s.name === course.name)
    : [];
  return { ...course, slots, noAttendance: !!course.noAttendance };
}

// Hesaba saat bilgisi (slots) olmadan yazılır; web sitesi de saatleri yeniden üretir
const slim = plan => plan.map(({ slots, ...rest }) => rest);

export function PlanProvider({ children }) {
  const { user } = useAuth();
  const [plannedCourses, setPlannedCourses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState('guest'); // guest | loading | saving | saved | error
  const touched = useRef(false);
  // Hesaptaki taslak okunmadan buluta yazılırsa web'deki taslak ezilir; bu yüzden hangi
  // kullanıcının taslağının yüklendiği tutulur ve yalnızca ondan sonra kaydedilir.
  const remoteLoadedFor = useRef(null);
  const saveTimer = useRef(null);
  const planRef = useRef(plannedCourses);
  planRef.current = plannedCourses;

  useEffect(() => {
    StorageService.loadPlan().then(saved => {
      // Yükleme bitmeden kullanıcı ders eklediyse kayıtlı taslakla birleştir
      setPlannedCourses(prev => {
        const rehydrated = saved.map(withSlots);
        if (!touched.current) return rehydrated;
        const known = new Set(prev.map(c => c.uniqueId));
        return [...prev, ...rehydrated.filter(c => !known.has(c.uniqueId))];
      });
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) StorageService.savePlan(plannedCourses);
  }, [plannedCourses, loaded]);

  const pushRemote = useCallback(async (userId, plan) => {
    setSyncStatus('saving');
    const { error } = await supabase.from('user_plans').upsert({
      user_id: userId,
      courses: slim(plan),
      updated_at: new Date().toISOString(),
    });
    setSyncStatus(error ? 'error' : 'saved');
  }, []);

  // Giriş yapılınca hesaptaki taslağı çek, yalnızca bu cihazda olan derslerle birleştir
  useEffect(() => {
    if (!loaded) return;
    if (!user) {
      remoteLoadedFor.current = null;
      setSyncStatus('guest');
      return;
    }
    if (remoteLoadedFor.current === user.id) return;

    let cancelled = false;
    setSyncStatus('loading');
    supabase.from('user_plans').select('courses').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setSyncStatus('error');
          return;
        }
        const remote = Array.isArray(data?.courses) ? data.courses.map(withSlots) : [];
        const known = new Set(remote.map(c => c.uniqueId));
        const localOnly = planRef.current.filter(c => !known.has(c.uniqueId));
        const merged = remote.concat(localOnly);
        remoteLoadedFor.current = user.id;
        setPlannedCourses(merged);
        if (localOnly.length || !data) pushRemote(user.id, merged);
        else setSyncStatus('saved');
      });
    return () => { cancelled = true; };
  }, [user, loaded, pushRemote]);

  // Girişliyken her değişiklik kısa bir gecikmeyle hesaba kaydedilir
  useEffect(() => {
    if (!user || remoteLoadedFor.current !== user.id || !touched.current) return;
    clearTimeout(saveTimer.current);
    setSyncStatus('saving');
    saveTimer.current = setTimeout(() => pushRemote(user.id, plannedCourses), 600);
    return () => clearTimeout(saveTimer.current);
  }, [plannedCourses, user, pushRemote]);

  const update = useCallback(fn => {
    touched.current = true;
    setPlannedCourses(fn);
  }, []);

  const addCourse = useCallback(course => {
    update(prev => (prev.some(p => p.uniqueId === course.uniqueId) ? prev : [...prev, withSlots(course)]));
  }, [update]);

  const removeCourse = useCallback(uniqueId => {
    update(prev => prev.filter(p => p.uniqueId !== uniqueId));
  }, [update]);

  const toggleAttendance = useCallback(uniqueId => {
    update(prev => prev.map(p => (p.uniqueId === uniqueId ? { ...p, noAttendance: !p.noAttendance } : p)));
  }, [update]);

  const clearPlan = useCallback(() => update(() => []), [update]);

  const value = useMemo(() => ({
    plannedCourses, loaded, syncStatus, addCourse, removeCourse, toggleAttendance, clearPlan
  }), [plannedCourses, loaded, syncStatus, addCourse, removeCourse, toggleAttendance, clearPlan]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan, PlanProvider içinde kullanılmalı');
  return ctx;
}
