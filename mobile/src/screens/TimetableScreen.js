import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DAYS } from '../theme/colors';
import { cleanStr, getCurrentDay, getTodayName, mergeConsecutiveSlots, pad2 } from '../utils/helpers';
import { StorageService } from '../services/storageService';
import programsData from '../data/programs.json';

export default function TimetableScreen({ navigation }) {
  const allProgramKeys = useMemo(() => Object.keys(programsData).sort(), []);
  
  // Default to first department or Bilgisayar Mühendisliği if found
  const initialProgram = useMemo(() => {
    const bm = allProgramKeys.find(k => k.toLowerCase().includes('bilgisayar') && k.includes('1'));
    return bm || allProgramKeys[0] || '';
  }, [allProgramKeys]);

  const [selectedProgramKey, setSelectedProgramKey] = useState(initialProgram);
  const [selectedDay, setSelectedDay] = useState(getCurrentDay());
  const [modalVisible, setModalVisible] = useState(false);
  const [progSearch, setProgSearch] = useState('');

  // En son seçilen bölümü hatırla
  useEffect(() => {
    StorageService.getFavoriteProgram().then(saved => {
      if (saved && programsData[saved]) setSelectedProgramKey(saved);
    });
  }, []);

  const selectProgram = (key) => {
    setSelectedProgramKey(key);
    setModalVisible(false);
    setProgSearch('');
    StorageService.saveFavoriteProgram(key);
  };

  // Selected program data
  const currentProgram = programsData[selectedProgramKey] || null;

  // Filtered program keys for modal
  const filteredProgramKeys = useMemo(() => {
    if (!progSearch.trim()) return allProgramKeys;
    const q = cleanStr(progSearch);
    return allProgramKeys.filter(k => cleanStr(k).includes(q));
  }, [allProgramKeys, progSearch]);

  // Daily courses for the chosen day
  const dailyCourses = useMemo(() => {
    if (!currentProgram || !currentProgram.courses) return [];
    const normDay = cleanStr(selectedDay);
    
    // Aynı dersin art arda saatleri tek kartta gösterilir (ör. 08:00 - 09:45)
    return mergeConsecutiveSlots(currentProgram.courses.filter(c => cleanStr(c.day) === normDay));
  }, [currentProgram, selectedDay]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Ders Programı</Text>
          <Text style={styles.subtitle}>Bölüm ve Sınıf Bazlı Haftalık Çizelge</Text>
        </View>

        {/* Program Selector Button */}
        <TouchableOpacity
          style={styles.selectorBtn}
          onPress={() => setModalVisible(true)}
        >
          <View style={styles.selectorIconWrap}>
            <Ionicons name="school" size={20} color={COLORS.primaryLight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectorLabel}>Seçili Bölüm / Sınıf</Text>
            <Text style={styles.selectorValue} numberOfLines={1}>
              {currentProgram?.title || selectedProgramKey || 'Bölüm Seçiniz'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Days Bar */}
        <View style={styles.daysContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScroll}>
            {DAYS.map(day => {
              const isSelected = day === selectedDay;
              const countForDay = (currentProgram?.courses || []).filter(c => cleanStr(c.day) === cleanStr(day)).length;
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
                      <Text style={[styles.countBadgeText, isSelected && { color: COLORS.primary }]}>
                        {countForDay}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Courses List */}
        <FlatList
          data={dailyCourses}
          keyExtractor={(block, idx) => `${block.first.code}_${block.startHour}_${idx}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.textDark} />
              <Text style={styles.emptyTitle}>{selectedDay} Günü Ders Yok</Text>
              <Text style={styles.emptyDesc}>Bu program için seçili günde ders planlanmamış.</Text>
            </View>
          }
          renderItem={({ item: block }) => {
            const item = block.first;
            const hourCount = block.endHour - block.startHour + 1;
            return (
            <View style={styles.courseCard}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeStart}>{pad2(block.startHour)}:00</Text>
                <Text style={styles.timeEnd}>{pad2(block.endHour)}:45</Text>
                {hourCount > 1 && <Text style={styles.timeEnd}>{hourCount} saat</Text>}
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.courseDetails}>
                <View style={styles.courseTopRow}>
                  <Text style={styles.courseCode}>{item.code || 'DERS'}</Text>
                  <View style={styles.badgesWrap}>
                    {item.elective && (
                      <View style={styles.electiveBadge}>
                        <Text style={styles.electiveText}>Seçmeli</Text>
                      </View>
                    )}
                    <View style={styles.sectionBadge}>
                      <Text style={styles.sectionText}>{item.section || 'Şb 1'}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.courseName}>{item.name}</Text>

                <View style={styles.metaRow}>
                  {item.classroom ? (
                    <View style={styles.metaItem}>
                      <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
                      <Text style={styles.metaText}>{item.classroom}</Text>
                    </View>
                  ) : null}

                  {item.instructor ? (
                    <TouchableOpacity
                      style={styles.metaItemInstructor}
                      onPress={() => {
                        navigation.navigate('Hoca', { initialInstructor: item.instructor, requestId: Date.now() });
                      }}
                    >
                      <Ionicons name="person-outline" size={13} color={COLORS.secondaryLight} />
                      <Text style={styles.instructorText}>{item.instructor}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
            );
          }}
        />

        {/* Modal: Select Department / Program */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Bölüm & Sınıf Seçin</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSearch}>
                <Ionicons name="search" size={16} color={COLORS.textDark} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Bölüm ara (örn: Bilgisayar, Makine, 1. Sınıf)..."
                  placeholderTextColor={COLORS.textDark}
                  value={progSearch}
                  onChangeText={setProgSearch}
                  autoFocus={true}
                />
              </View>

              <FlatList
                data={filteredProgramKeys}
                keyExtractor={item => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isCurrent = item === selectedProgramKey;
                  return (
                    <TouchableOpacity
                      style={[styles.modalItem, isCurrent && styles.modalItemActive]}
                      onPress={() => selectProgram(item)}
                    >
                      <Text style={[styles.modalItemText, isCurrent && styles.modalItemTextActive]}>
                        {programsData[item]?.title || item}
                      </Text>
                      {isCurrent && (
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.primaryLight} />
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
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 12,
  },
  selectorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textDark,
    textTransform: 'uppercase',
  },
  selectorValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  daysContainer: {
    marginBottom: 14,
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
  courseCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeColumn: {
    width: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeStart: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryLight,
  },
  timeEnd: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textDark,
    marginTop: 2,
  },
  cardDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  courseDetails: {
    flex: 1,
  },
  courseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseCode: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  badgesWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  electiveBadge: {
    backgroundColor: COLORS.warningBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  electiveText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.warning,
  },
  sectionBadge: {
    backgroundColor: COLORS.cardSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectionText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  metaItemInstructor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  instructorText: {
    fontSize: 11,
    color: COLORS.secondaryLight,
    fontWeight: '600',
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
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
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
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
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalItemActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 10,
  },
  modalItemText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modalItemTextActive: {
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
});
