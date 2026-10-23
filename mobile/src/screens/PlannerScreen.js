import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Switch,
  Alert,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DAYS } from '../theme/colors';
import { cleanStr, getCurrentDay, getTodayName, mergeConsecutiveSlots, pad2 } from '../utils/helpers';
import { usePlan } from '../context/PlanContext';
import programsData from '../data/programs.json';

const ALL_PROGRAM_KEYS = Object.keys(programsData).sort((a, b) => a.localeCompare(b, 'tr'));
const DAY_SHORT = { 'Pazartesi': 'Pzt', 'Salı': 'Sal', 'Çarşamba': 'Çar', 'Perşembe': 'Per', 'Cuma': 'Cum' };

// "Pzt 08:00-09:45, Çar 13:00-13:45" biçiminde kısa saat özeti
function slotSummary(slots) {
  return DAYS.map(day => {
    const blocks = mergeConsecutiveSlots((slots || []).filter(s => s.day === day), s => s.day);
    return blocks.map(b => `${DAY_SHORT[day]} ${pad2(b.startHour)}:00-${pad2(b.endHour)}:45`).join(', ');
  }).filter(Boolean).join(' • ');
}

export default function PlannerScreen() {
  const { plannedCourses, addCourse, removeCourse, toggleAttendance, clearPlan } = usePlan();

  const [selectedProgKey, setSelectedProgKey] = useState(ALL_PROGRAM_KEYS[0] || '');
  const [progModalVisible, setProgModalVisible] = useState(false);
  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [progSearch, setProgSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [activeViewTab, setActiveViewTab] = useState('list'); // 'list' or 'schedule'
  const [selectedDay, setSelectedDay] = useState(getCurrentDay());

  const filteredProgramKeys = useMemo(() => {
    const q = cleanStr(progSearch);
    return q ? ALL_PROGRAM_KEYS.filter(k => cleanStr(k).includes(q)) : ALL_PROGRAM_KEYS;
  }, [progSearch]);

  // Seçili programdaki tekil dersler (ders + şube)
  const distinctCourses = useMemo(() => {
    const prog = programsData[selectedProgKey];
    if (!prog) return [];
    const map = new Map();
    (prog.courses || []).forEach(c => {
      if (!c.code && !c.name) return;
      const uKey = `${selectedProgKey}__${c.code}__${c.section}__${c.name}`;
      if (!map.has(uKey)) {
        map.set(uKey, {
          uniqueId: uKey,
          programKey: selectedProgKey,
          code: c.code,
          name: c.name,
          section: c.section,
          programTitle: prog.title || selectedProgKey,
          elective: c.elective,
          slots: []
        });
      }
      map.get(uKey).slots.push(c);
    });
    return Array.from(map.values()).sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, 'tr'));
  }, [selectedProgKey]);

  const filteredCourses = useMemo(() => {
    const q = cleanStr(courseSearch);
    if (!q) return distinctCourses;
    return distinctCourses.filter(c => cleanStr(`${c.code} ${c.name}`).includes(q));
  }, [distinctCourses, courseSearch]);

  const handleAdd = (target) => {
    const { slots, ...course } = target;
    addCourse(course);
  };

  const confirmRemove = (course) => {
    Alert.alert('Dersi Sil', `${course.code || ''} ${course.name} taslaktan çıkarılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => removeCourse(course.uniqueId) }
    ]);
  };

  const confirmClear = () => {
    Alert.alert('Taslağı Temizle', `Taslaktaki ${plannedCourses.length} dersin tamamı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Tümünü Sil', style: 'destructive', onPress: clearPlan }
    ]);
  };

  // Çakışma hesabı: aynı gün/saatte devam zorunluluğu olan birden çok ders
  const { conflicts, clashKeys } = useMemo(() => {
    const timeSlotMap = {};
    plannedCourses.forEach(course => {
      (course.slots || []).forEach(slot => {
        const key = `${cleanStr(slot.day)}_${slot.hour}`;
        if (!timeSlotMap[key]) timeSlotMap[key] = [];
        if (!timeSlotMap[key].some(x => x.course.uniqueId === course.uniqueId)) {
          timeSlotMap[key].push({ course, slot });
        }
      });
    });

    const clashList = [];
    const keys = new Set();
    Object.entries(timeSlotMap).forEach(([key, items]) => {
      const mandatory = items.filter(x => !x.course.noAttendance);
      if (mandatory.length > 1) {
        keys.add(key);
        clashList.push({
          day: items[0].slot.day,
          hour: items[0].slot.hour,
          courses: mandatory.map(x => x.course.code || x.course.name)
        });
      }
    });
    clashList.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.hour - b.hour);
    return { conflicts: clashList, clashKeys: keys };
  }, [plannedCourses]);
  const hasClash = conflicts.length > 0;

  // Seçili gündeki dersler (art arda saatler birleştirilmiş)
  const dailyScheduledItems = useMemo(() => {
    const normDay = cleanStr(selectedDay);
    const items = [];
    plannedCourses.forEach(c => {
      const daySlots = (c.slots || []).filter(s => cleanStr(s.day) === normDay);
      mergeConsecutiveSlots(daySlots).forEach(block => {
        const clash = block.items.some(s => clashKeys.has(`${normDay}_${s.hour}`)) && !c.noAttendance;
        items.push({ course: c, block, clash });
      });
    });
    return items.sort((a, b) => a.block.startHour - b.block.startHour);
  }, [plannedCourses, selectedDay, clashKeys]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Ders Taslağı</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={styles.subtitle}>{plannedCourses.length} Ders Taslakta</Text>
              {plannedCourses.length > 0 && (
                <TouchableOpacity onPress={confirmClear} hitSlop={8}>
                  <Text style={[styles.subtitle, { color: COLORS.danger }]}>Temizle</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Switch View Toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, activeViewTab === 'list' && styles.toggleBtnActive]}
              onPress={() => setActiveViewTab('list')}
            >
              <Ionicons name="list" size={16} color={activeViewTab === 'list' ? '#fff' : COLORS.textMuted} />
              <Text style={[styles.toggleBtnText, activeViewTab === 'list' && { color: '#fff' }]}>Dersler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, activeViewTab === 'schedule' && styles.toggleBtnActive]}
              onPress={() => setActiveViewTab('schedule')}
            >
              <Ionicons name="calendar" size={16} color={activeViewTab === 'schedule' ? '#fff' : COLORS.textMuted} />
              <Text style={[styles.toggleBtnText, activeViewTab === 'schedule' && { color: '#fff' }]}>Program</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Conflict Alert Banner */}
        {hasClash ? (
          <View style={styles.clashBanner}>
            <Ionicons name="warning" size={20} color={COLORS.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.clashTitle}>{conflicts.length} Saatte Çakışma Var!</Text>
              {conflicts.slice(0, 4).map((cf, idx) => (
                <Text key={idx} style={styles.clashDesc}>
                  • {cf.day} {pad2(cf.hour)}:00 — {cf.courses.join(' ile ')}
                </Text>
              ))}
              {conflicts.length > 4 && (
                <Text style={styles.clashDesc}>… ve {conflicts.length - 4} saat daha (Program görünümüne bakın)</Text>
              )}
            </View>
          </View>
        ) : plannedCourses.length > 0 ? (
          <View style={styles.noClashBanner}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            <Text style={styles.noClashText}>Taslak dersleriniz arasında devam çakışması yok.</Text>
          </View>
        ) : null}

        {/* Quick Add Course Button */}
        <TouchableOpacity
          style={styles.addCourseBtn}
          onPress={() => setProgModalVisible(true)}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.addCourseBtnText}>Yeni Ders Ekle</Text>
        </TouchableOpacity>

        {activeViewTab === 'list' ? (
          <FlatList
            data={plannedCourses}
            keyExtractor={item => item.uniqueId}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={48} color={COLORS.textDark} />
                <Text style={styles.emptyTitle}>Taslağınız Henüz Boş</Text>
                <Text style={styles.emptyDesc}>
                  Dönem derslerinizi ekleyip çakışma kontrolü yapmak için yukarıdaki butona dokunun. Eklediğiniz derslerin sınavları Sınavlar sekmesinde listelenir.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.planCard, item.noAttendance && styles.planCardExempt]}>
                <View style={styles.planCardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.codeRow}>
                      <Text style={styles.planCode}>{item.code || 'DERS'}</Text>
                      <View style={styles.sectionBadge}>
                        <Text style={styles.sectionBadgeText}>{item.section || 'Şb 1'}</Text>
                      </View>
                      {item.noAttendance && (
                        <View style={styles.exemptBadge}>
                          <Text style={styles.exemptBadgeText}>✓ Devam Muafiyeti</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.planName}>{item.name}</Text>
                    <Text style={styles.planProg} numberOfLines={1}>{item.programTitle}</Text>
                    <Text style={styles.planProg}>
                      {item.slots && item.slots.length ? slotSummary(item.slots) : '⚠️ Bu ders güncel programda bulunamadı'}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmRemove(item)}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>

                {/* Switch: Alttan Ders / Devam Muafiyeti */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Devam zorunluluğum yok (Alttan ders)</Text>
                    <Text style={styles.switchHint}>Aktif edildiğinde bu ders çakışma uyarısı vermez.</Text>
                  </View>
                  <Switch
                    value={!!item.noAttendance}
                    onValueChange={() => toggleAttendance(item.uniqueId)}
                    trackColor={{ false: COLORS.cardSecondary, true: COLORS.success }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            )}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.daysScrollWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {DAYS.map(day => {
                  const isSelected = day === selectedDay;
                  const dayClash = conflicts.some(c => c.day === day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, isSelected && styles.dayChipActive]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                        {dayClash ? '⚠️ ' : ''}{day}{day === getTodayName() ? ' •' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <FlatList
              data={dailyScheduledItems}
              keyExtractor={(it, idx) => `${it.course.uniqueId}_${it.block.startHour}_${idx}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="cafe-outline" size={44} color={COLORS.textDark} />
                  <Text style={styles.emptyTitle}>{selectedDay} Günü Boşsunuz</Text>
                  <Text style={styles.emptyDesc}>Taslağınızdaki derslerden hiçbiri bu güne denk gelmiyor.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[
                  styles.schedItemCard,
                  item.course.noAttendance && styles.schedItemExempt,
                  item.clash && { borderColor: COLORS.danger, backgroundColor: COLORS.dangerBg }
                ]}>
                  <View style={styles.schedTimeWrap}>
                    <Text style={styles.schedTime}>{pad2(item.block.startHour)}:00</Text>
                    <Text style={[styles.slotRoom, { textAlign: 'center' }]}>{pad2(item.block.endHour)}:45</Text>
                  </View>
                  <View style={styles.schedInfoWrap}>
                    <View style={styles.codeRow}>
                      <Text style={styles.planCode}>{item.course.code}</Text>
                      <Text style={styles.slotRoom}>{item.block.first.classroom || 'Sınıf Yok'}</Text>
                    </View>
                    <Text style={styles.planName}>{item.course.name}</Text>
                    {item.clash && <Text style={[styles.exemptNotice, { color: COLORS.danger }]}>⚠️ Bu saatte çakışma var</Text>}
                    {item.course.noAttendance && (
                      <Text style={styles.exemptNotice}>* Devam zorunluluğu muaf</Text>
                    )}
                  </View>
                </View>
              )}
            />
          </View>
        )}

        {/* Modal 1: Bölüm Seçimi */}
        <Modal
          visible={progModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setProgModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Adım 1: Bölüm Seçin</Text>
                <TouchableOpacity onPress={() => setProgModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSearch}>
                <Ionicons name="search" size={16} color={COLORS.textDark} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Bölüm ara..."
                  placeholderTextColor={COLORS.textDark}
                  value={progSearch}
                  onChangeText={setProgSearch}
                />
              </View>

              <FlatList
                data={filteredProgramKeys}
                keyExtractor={item => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedProgKey(item);
                      setCourseSearch('');
                      setProgModalVisible(false);
                      setCourseModalVisible(true);
                    }}
                  >
                    <Text style={styles.modalItemText}>{programsData[item]?.title || item}</Text>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Modal 2: Ders & Şube Seçimi */}
        <Modal
          visible={courseModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCourseModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => { setCourseModalVisible(false); setProgModalVisible(true); }}
                  hitSlop={8}
                  style={{ marginRight: 8 }}
                >
                  <Ionicons name="chevron-back" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Adım 2: Ders & Şube Seçin</Text>
                  <Text style={styles.modalSubTitle} numberOfLines={1}>{programsData[selectedProgKey]?.title}</Text>
                </View>
                <TouchableOpacity onPress={() => setCourseModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSearch}>
                <Ionicons name="search" size={16} color={COLORS.textDark} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Ders kodu veya adı ara..."
                  placeholderTextColor={COLORS.textDark}
                  value={courseSearch}
                  onChangeText={setCourseSearch}
                />
              </View>

              <FlatList
                data={filteredCourses}
                keyExtractor={item => item.uniqueId}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: COLORS.textMuted }}>Eşleşen ders bulunamadı.</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isAdded = plannedCourses.some(p => p.uniqueId === item.uniqueId);
                  return (
                    <TouchableOpacity
                      style={[styles.coursePickItem, isAdded && styles.coursePickItemDisabled]}
                      onPress={() => !isAdded && handleAdd(item)}
                      disabled={isAdded}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.codeRow}>
                          <Text style={styles.planCode}>[{item.code || 'DERS'}]</Text>
                          <View style={styles.sectionBadge}>
                            <Text style={styles.sectionBadgeText}>{item.section || 'Şb 1'}</Text>
                          </View>
                          {item.elective && (
                            <View style={styles.electiveBadge}>
                              <Text style={styles.electiveText}>Seçmeli</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.planName}>{item.name}</Text>
                        <Text style={styles.planProg}>{slotSummary(item.slots)}</Text>
                      </View>

                      {isAdded ? (
                        <View style={styles.addedPill}>
                          <Text style={styles.addedPillText}>Eklendi</Text>
                        </View>
                      ) : (
                        <Ionicons name="add" size={22} color={COLORS.primaryLight} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  clashBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.dangerBg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    marginBottom: 12,
  },
  clashTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.danger,
    marginBottom: 4,
  },
  clashDesc: {
    fontSize: 11,
    color: '#fda4af',
    lineHeight: 16,
  },
  noClashBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.successBg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    marginBottom: 12,
  },
  noClashText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.success,
    flex: 1,
  },
  addCourseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  addCourseBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planCardExempt: {
    borderColor: COLORS.successBorder,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  planCode: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryLight,
  },
  sectionBadge: {
    backgroundColor: COLORS.cardSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  exemptBadge: {
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },
  exemptBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.success,
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  planProg: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  switchHint: {
    fontSize: 10,
    color: COLORS.textDark,
    marginTop: 1,
  },
  daysScrollWrap: {
    marginBottom: 12,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  dayTextActive: {
    color: '#fff',
  },
  schedItemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  schedItemExempt: {
    borderColor: COLORS.successBorder,
  },
  schedTimeWrap: {
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  schedTime: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryLight,
  },
  schedInfoWrap: {
    flex: 1,
  },
  slotRoom: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  exemptNotice: {
    fontSize: 10,
    color: COLORS.success,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '75%',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalSubTitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalSearchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalItemText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  coursePickItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  coursePickItemDisabled: {
    opacity: 0.5,
  },
  electiveBadge: {
    backgroundColor: COLORS.warningBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  electiveText: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.warning,
  },
  addedPill: {
    backgroundColor: COLORS.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
});
