import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
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

  // Kaydedilmemiş yerel değişiklik var mı? (varsa buluttan gelen veri onu ezmesin)
  const dirty = useRef(false);
  const pulling = useRef(false);

  const pushRemote = useCallback(async (userId, plan) => {
    setSyncStatus('saving');
    const { error } = await supabase.from('user_plans').upsert({
      user_id: userId,
      courses: slim(plan),
      updated_at: new Date().toISOString(),
    });
    if (!error && planRef.current === plan) dirty.current = false;
    setSyncStatus(error ? 'error' : 'saved');
  }, []);

  // Hesaptaki taslağı çeker.
  // İlk çekişte bu cihazdaki derslerle birleştirir; sonraki çekişlerde (uygulama öne gelince,
  // sekme açılınca) web'de yapılan ekleme/silmeler aynen alınır.
  const pullRemote = useCallback(async () => {
    if (!user || pulling.current) return;
    if (remoteLoadedFor.current === user.id && dirty.current) return;
    pulling.current = true;
    const initial = remoteLoadedFor.current !== user.id;
    if (initial) setSyncStatus('loading');
    const { data, error } = await supabase
      .from('user_plans').select('courses').eq('user_id', user.id).maybeSingle();
    pulling.current = false;
    if (error) {
      if (initial) setSyncStatus('error');
      return;
    }
    const remote = Array.isArray(data?.courses) ? data.courses.map(withSlots) : [];
    if (initial) {
      const known = new Set(remote.map(c => c.uniqueId));
      const localOnly = planRef.current.filter(c => !known.has(c.uniqueId));
      const merged = remote.concat(localOnly);
      remoteLoadedFor.current = user.id;
      setPlannedCourses(merged);
      if (localOnly.length || !data) pushRemote(user.id, merged);
      else { dirty.current = false; setSyncStatus('saved'); }
      return;
    }
    if (dirty.current) return; // çekiş sürerken kullanıcı değişiklik yaptı
    const sig = list => JSON.stringify(list.map(c => [c.uniqueId, !!c.noAttendance]));
    if (sig(remote) !== sig(planRef.current)) setPlannedCourses(remote);
    setSyncStatus('saved');
  }, [user, pushRemote]);

  // Giriş/çıkışta durumu güncelle ve hesaptaki taslağı çek
  useEffect(() => {
    if (!loaded) return;
    if (!user) {
      remoteLoadedFor.current = null;
      setSyncStatus('guest');
      return;
    }
    pullRemote();
  }, [user, loaded, pullRemote]);

  // Uygulama arka plandan öne gelince web'deki değişiklikleri al
  useEffect(() => {
    if (!loaded || !user) return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') pullRemote();
    });
    return () => sub.remove();
  }, [loaded, user, pullRemote]);

  // Girişliyken her değişiklik kısa bir gecikmeyle hesaba kaydedilir
  useEffect(() => {
    if (!user || remoteLoadedFor.current !== user.id || !dirty.current) return;
    clearTimeout(saveTimer.current);
    setSyncStatus('saving');
    saveTimer.current = setTimeout(() => pushRemote(user.id, plannedCourses), 600);
    return () => clearTimeout(saveTimer.current);
  }, [plannedCourses, user, pushRemote]);

  const update = useCallback(fn => {
    touched.current = true;
    dirty.current = true;
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
    plannedCourses, loaded, syncStatus, addCourse, removeCourse, toggleAttendance, clearPlan, refresh: pullRemote
  }), [plannedCourses, loaded, syncStatus, addCourse, removeCourse, toggleAttendance, clearPlan, pullRemote]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan, PlanProvider içinde kullanılmalı');
  return ctx;
}
