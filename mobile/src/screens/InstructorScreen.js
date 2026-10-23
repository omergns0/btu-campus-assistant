import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DAYS } from '../theme/colors';
import {
  cleanStr, instrKey, buildInstructorIndex, parseInstructorField,
  getCurrentDay, getTodayName, mergeConsecutiveSlots, pad2
} from '../utils/helpers';
import programsData from '../data/programs.json';

// Dizin bir kez üretilir: aynı ders birden çok programda listelense de saat bir kez sayılır
const { index: INSTRUCTOR_INDEX, aliases: INSTRUCTOR_ALIASES } = buildInstructorIndex(programsData);
const INSTRUCTOR_LIST = Object.values(INSTRUCTOR_INDEX).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

function resolveKey(key) {
  return INSTRUCTOR_INDEX[key] ? key : (INSTRUCTOR_ALIASES[key] || '');
}

function weeklyHours(inst) {
  return new Set(Array.from(inst.slots.values()).map(s => `${cleanStr(s.day)}_${s.hour}`)).size;
}

function getLiveStatus(slots, now) {
  const today = getTodayName();
  if (!today) return { text: 'Bugün hafta sonu, ders yok', color: COLORS.textMuted, course: null };
  const h = now.getHours();
  const m = now.getMinutes();
  const todays = slots.filter(s => cleanStr(s.day) === cleanStr(today)).sort((a, b) => a.hour - b.hour);
  const current = todays.find(s => s.hour === h && m < 45);
  if (current) {
    return {
      text: 'Şu an derste',
      color: COLORS.danger,
      course: `${current.code || ''} ${current.name || ''}`.trim(),
      room: current.classroom || 'Derslik belirtilmemiş',
      hour: `${pad2(current.hour)}:00 - ${pad2(current.hour)}:45`
    };
  }
  const next = todays.find(s => s.hour > h);
  if (next) {
    return {
      text: 'Sıradaki ders',
      color: COLORS.warning,
      course: `${next.code || ''} ${next.name || ''}`.trim(),
      room: next.classroom || 'Derslik belirtilmemiş',
      hour: `${pad2(next.hour)}:00`
    };
  }
  return {
    text: todays.length ? 'Bugünkü dersleri tamamlandı' : 'Bugün dersi yok',
    color: COLORS.success,
    course: null
  };
}

export default function InstructorScreen({ route }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState(INSTRUCTOR_LIST[0]?.key || '');
  const [selectedDay, setSelectedDay] = useState(getCurrentDay());
  const [now, setNow] = useState(() => new Date());

  // Canlı durum dakikada bir yenilenir
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Ders programı ekranından hoca adına dokunulduğunda gelir
  useEffect(() => {
    const raw = route.params?.initialInstructor;
    if (!raw) return;
    const key = parseInstructorField(raw).map(p => resolveKey(p.key)).find(Boolean)
      || resolveKey(instrKey(raw));
    if (key) {
      setSelectedKey(key);
      setSearchQuery('');
    }
  }, [route.params?.initialInstructor, route.params?.requestId]);

  const searchResults = useMemo(() => {
    const q = instrKey(searchQuery);
    if (!q) return [];
    return INSTRUCTOR_LIST.filter(inst =>
      inst.key.includes(q) || Array.from(inst.depts).some(d => instrKey(d).includes(q))
    ).slice(0, 40);
  }, [searchQuery]);

  const currentInstructor = INSTRUCTOR_INDEX[selectedKey] || INSTRUCTOR_LIST[0];
  const slots = useMemo(() => (currentInstructor ? Array.from(currentInstructor.slots.values()) : []), [currentInstructor]);

  const currentDailyBlocks = useMemo(() => {
    const normDay = cleanStr(selectedDay);
    return mergeConsecutiveSlots(slots.filter(s => cleanStr(s.day) === normDay));
  }, [slots, selectedDay]);

  const liveStatus = useMemo(() => getLiveStatus(slots, now), [slots, now]);

  const selectInstructor = (key) => {
    setSelectedKey(key);
    setSearchQuery('');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Hoca Programı</Text>
          <Text style={styles.subtitle}>{INSTRUCTOR_LIST.length} Öğretim Elemanı Kayıtlı</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textDark} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Hoca adı veya bölüm ara..."
            placeholderTextColor={COLORS.textDark}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textDark} />
            </TouchableOpacity>
          )}
        </View>

        {searchQuery.trim().length > 0 ? (
          /* Arama sonuçları */
          <FlatList
            data={searchResults}
            keyExtractor={inst => inst.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="person-outline" size={40} color={COLORS.textDark} />
                <Text style={styles.emptyTitle}>Eşleşen öğretim elemanı yok</Text>
              </View>
            }
            renderItem={({ item: inst }) => (
              <TouchableOpacity style={styles.scheduleCard} onPress={() => selectInstructor(inst.key)}>
                <View style={styles.avatarWrap}>
                  <Ionicons name="person" size={20} color={COLORS.secondaryLight} />
                </View>
                <View style={styles.scheduleDetails}>
                  <Text style={styles.courseName}>{inst.name}</Text>
                  <Text style={styles.metaText} numberOfLines={1}>
                    {inst.title || 'Öğretim Elemanı'} • {weeklyHours(inst)} saat/hafta • {Array.from(inst.depts).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          <>
            {/* Selected Instructor Profile & Live Status Card */}
            {currentInstructor && (
              <View style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  <View style={styles.avatarWrap}>
                    <Ionicons name="person" size={24} color={COLORS.secondaryLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.instDept}>{currentInstructor.title || 'Öğretim Elemanı'}</Text>
                    <Text style={styles.instName}>{currentInstructor.name}</Text>
                    <Text style={styles.instDept} numberOfLines={1}>
                      {Array.from(currentInstructor.depts).join(', ')}
                    </Text>
                  </View>
                  <View style={styles.totalBadge}>
                    <Text style={styles.totalBadgeText}>{weeklyHours(currentInstructor)} Saat</Text>
                  </View>
                </View>

                {/* Live Status Row */}
                <View style={[styles.liveStatusRow, { borderColor: liveStatus.color }]}>
                  <View style={[styles.liveStatusDot, { backgroundColor: liveStatus.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.liveStatusText, { color: liveStatus.color }]}>
                      {liveStatus.text}{liveStatus.hour ? ` (${liveStatus.hour})` : ''}
                    </Text>
                    {liveStatus.course && (
                      <Text style={styles.liveStatusCourse} numberOfLines={1}>
                        {liveStatus.course} • {liveStatus.room}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Days Bar */}
            <View style={styles.daysContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScroll}>
                {DAYS.map(day => {
                  const isSelected = day === selectedDay;
                  const countForDay = slots.filter(s => cleanStr(s.day) === cleanStr(day)).length;
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, isSelected && styles.dayChipActive]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                        {day}{day === getTodayName() ? ' •' : ''}
                      </Text>
                      {countForDay > 0 && (
                        <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                          <Text style={[styles.countBadgeText, isSelected && { color: COLORS.secondary }]}>
                            {countForDay}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Daily Schedule List */}
            <FlatList
              data={currentDailyBlocks}
              keyExtractor={(block, idx) => `${block.first.code}_${block.startHour}_${idx}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="sunny-outline" size={44} color={COLORS.textDark} />
                  <Text style={styles.emptyTitle}>{selectedDay} Günü Dersi Yok</Text>
                  <Text style={styles.emptyDesc}>Öğretim elemanının bu gün için planlanmış dersi bulunmuyor.</Text>
                </View>
              }
              renderItem={({ item: block }) => {
                const item = block.first;
                const programs = new Set();
                block.items.forEach(s => s.programs.forEach(p => programs.add(p)));
                const progList = Array.from(programs);
                return (
                  <View style={styles.scheduleCard}>
                    <View style={styles.timeWrap}>
                      <Text style={styles.timeStart}>{pad2(block.startHour)}:00</Text>
                      <Text style={styles.timeEnd}>{pad2(block.endHour)}:45</Text>
                    </View>

                    <View style={styles.scheduleDetails}>
                      <View style={styles.codeRow}>
                        <Text style={styles.courseCode}>{item.code || 'DERS'}</Text>
                        <View style={styles.sectionBadge}>
                          <Text style={styles.sectionBadgeText}>{item.section || 'Şb 1'}</Text>
                        </View>
                      </View>

                      <Text style={styles.courseName}>{item.name}</Text>

                      <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                          <Ionicons name="location" size={13} color={COLORS.primaryLight} />
                          <Text style={styles.metaText}>{item.classroom || 'Derslik Yok'}</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="school-outline" size={13} color={COLORS.textMuted} />
                          <Text style={styles.metaText} numberOfLines={1}>
                            {progList[0] || ''}{progList.length > 1 ? ` +${progList.length - 1}` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          </>
        )}

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
    paddingVertical: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  quickListContainer: {
    marginBottom: 12,
  },
  quickListScroll: {
    gap: 8,
  },
  instChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  instChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondaryLight,
  },
  instChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  instChipTextActive: {
    color: '#fff',
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  instDept: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  totalBadge: {
    backgroundColor: COLORS.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  totalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondaryLight,
  },
  liveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
  },
  liveStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  liveStatusCourse: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  daysContainer: {
    marginBottom: 12,
  },
  daysScroll: {
    gap: 8,
  },
  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondaryLight,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  dayTextActive: {
    color: '#fff',
  },
  countBadge: {
    backgroundColor: COLORS.cardSecondary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  countBadgeActive: {
    backgroundColor: '#fff',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  timeWrap: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingRight: 8,
  },
  timeStart: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.secondaryLight,
  },
  timeEnd: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textDark,
    marginTop: 2,
  },
  scheduleDetails: {
    flex: 1,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseCode: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
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
  courseName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  emptyState: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
});
