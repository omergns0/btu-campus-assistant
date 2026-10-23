import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StorageService } from '../services/storageService';
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

export function PlanProvider({ children }) {
  const [plannedCourses, setPlannedCourses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const touched = useRef(false);

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
    plannedCourses, loaded, addCourse, removeCourse, toggleAttendance, clearPlan
  }), [plannedCourses, loaded, addCourse, removeCourse, toggleAttendance, clearPlan]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan, PlanProvider içinde kullanılmalı');
  return ctx;
}
