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
import { cleanStr, getCampus, getBlock, getCurrentDay, getTodayName, getCurrentHour, isPhysicalClassroom, pad2 } from '../utils/helpers';
import classroomsData from '../data/classrooms.json';

// Ders programı olmayan kayıtlar (Uzaktan Eğitim, ofisler vb.) derslik listesine alınmaz
const ROOM_KEYS = Object.keys(classroomsData).filter(isPhysicalClassroom).sort((a, b) => a.localeCompare(b, 'tr'));

const TIME_PRESETS = [[8, 10], [9, 12], [10, 13], [11, 14], [13, 15], [13, 17], [14, 17], [15, 18], [17, 20]];

// Hafta içi ders saatindeysek "Şimdi" kısayolu: bu saat ve sonraki saat
function getNowPreset() {
  const h = getCurrentHour();
  if (!getTodayName() || h < 8 || h > 19) return null;
  return [h, Math.min(h + 2, 20)];
}

export default function EmptyClassroomsScreen() {
  const [selectedDay, setSelectedDay] = useState(getCurrentDay());
  const [selectedCampus, setSelectedCampus] = useState('ALL'); // ALL, MS, YB
  const [selectedBlock, setSelectedBlock] = useState('ALL');
  const nowPreset = useMemo(getNowPreset, []);
  const [startHour, setStartHour] = useState(nowPreset ? nowPreset[0] : 9);
  const [endHour, setEndHour] = useState(nowPreset ? nowPreset[1] : 12);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, EMPTY, BUSY
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Available Blocks
  const availableBlocks = useMemo(() => {
    const blocks = new Set();
    ROOM_KEYS.forEach(room => {
      if (selectedCampus === 'ALL' || getCampus(room) === selectedCampus) blocks.add(getBlock(room));
    });
    return ['ALL', ...Array.from(blocks).sort((a, b) => a.localeCompare(b, 'tr'))];
  }, [selectedCampus]);

  // Kampüs değişince listede olmayan blok seçimi sıfırlanır
  useEffect(() => {
    if (!availableBlocks.includes(selectedBlock)) setSelectedBlock('ALL');
  }, [availableBlocks, selectedBlock]);

  const activeFilterCount = (selectedCampus !== 'ALL') + (selectedBlock !== 'ALL') + (statusFilter !== 'ALL');

  // Filtered rooms calculation
  const { filteredRooms, emptyCount, busyCount } = useMemo(() => {
    const normDay = cleanStr(selectedDay);
    const normSearch = cleanStr(searchQuery);

    let eCount = 0;
    let bCount = 0;
    const results = [];

    ROOM_KEYS.forEach(room => {
      const schedule = classroomsData[room] || [];
      const roomCampus = getCampus(room);
      const roomBlock = getBlock(room);

      if (selectedCampus !== 'ALL' && roomCampus !== selectedCampus) return;
      if (selectedBlock !== 'ALL' && roomBlock !== selectedBlock) return;
      if (normSearch && !cleanStr(room).includes(normSearch)) return;

      const conflicts = schedule.filter(s => {
        if (cleanStr(s.day) !== normDay) return false;
        let h = -1;
        if (s.hour !== undefined) h = parseInt(s.hour, 10);
        else if (s.start) {
          const m = s.start.toString().match(/\d+/);
          if (m) h = parseInt(m[0], 10);
        }
        return h >= startHour && h < endHour;
      });

      const isFullyEmpty = conflicts.length === 0;
      if (isFullyEmpty) eCount++; else bCount++;

      if (statusFilter === 'EMPTY' && !isFullyEmpty) return;
      if (statusFilter === 'BUSY' && isFullyEmpty) return;

      results.push({
        room,
        campus: roomCampus,
        block: roomBlock,
        isFullyEmpty,
        conflicts
      });
    });

    return { filteredRooms: results, emptyCount: eCount, busyCount: bCount };
  }, [selectedDay, selectedCampus, selectedBlock, startHour, endHour, statusFilter, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Boş Derslikler</Text>
            <Text style={styles.subtitle}>
              {selectedDay} {pad2(startHour)}:00-{pad2(endHour)}:00 • {emptyCount} Boş • {busyCount} Dolu
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="filter" size={18} color={showFilters ? '#fff' : COLORS.textMuted} />
            <Text style={[styles.filterToggleText, showFilters && { color: '#fff' }]}>
              Filtrele{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textDark} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Derslik ara (örn: E/205, G Blok, Amfi)..."
            placeholderTextColor={COLORS.textDark}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textDark} />
            </TouchableOpacity>
          )}
        </View>

        {/* Days Bar */}
        <View style={styles.daysContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScroll}>
            {DAYS.map(day => {
              const isSelected = day === selectedDay;
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, isSelected && styles.dayChipActive]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                    {day}{day === getTodayName() ? ' • Bugün' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <View style={styles.filterPanel}>
            {/* Kampüs Seçimi */}
            <Text style={styles.filterLabel}>Kampüs</Text>
            <View style={styles.pillRow}>
              {[
                { id: 'ALL', label: 'Tümü' },
                { id: 'MS', label: 'Mimar Sinan' },
                { id: 'YB', label: 'Yıldırım' }
              ].map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.pill, selectedCampus === item.id && styles.pillActive]}
                  onPress={() => setSelectedCampus(item.id)}
                >
                  <Text style={[styles.pillText, selectedCampus === item.id && styles.pillTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Blok Seçimi */}
            <Text style={styles.filterLabel}>Blok</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hoursScroll}>
              {availableBlocks.map(b => {
                const isActive = selectedBlock === b;
                return (
                  <TouchableOpacity
                    key={b}
                    style={[styles.timeChip, isActive && styles.timeChipActive]}
                    onPress={() => setSelectedBlock(b)}
                  >
                    <Text style={[styles.timeChipText, isActive && styles.timeChipTextActive]}>
                      {b === 'ALL' ? 'Tüm Bloklar' : b}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Saat Aralığı */}
            <Text style={styles.filterLabel}>
              Saat Aralığı: {String(startHour).padStart(2, '0')}:00 - {String(endHour).padStart(2, '0')}:00
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hoursScroll}>
              {(nowPreset ? [nowPreset, ...TIME_PRESETS] : TIME_PRESETS).map(([s, e], idx) => {
                const isActive = startHour === s && endHour === e;
                const isNow = !!nowPreset && idx === 0;
                return (
                  <TouchableOpacity
                    key={`${isNow ? 'now' : 'p'}${s}-${e}`}
                    style={[styles.timeChip, isActive && styles.timeChipActive]}
                    onPress={() => {
                      setStartHour(s);
                      setEndHour(e);
                      if (isNow) setSelectedDay(getCurrentDay());
                    }}
                  >
                    <Text style={[styles.timeChipText, isActive && styles.timeChipTextActive]}>
                      {isNow ? '⚡ Şimdi ' : ''}{pad2(s)}:00-{pad2(e)}:00
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Durum Filtresi */}
            <View style={styles.statusRow}>
              {[
                { id: 'ALL', label: 'Tümü' },
                { id: 'EMPTY', label: 'Sadece Boş' },
                { id: 'BUSY', label: 'Dolu Olanlar' }
              ].map(st => (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.statusBtn, statusFilter === st.id && styles.statusBtnActive]}
                  onPress={() => setStatusFilter(st.id)}
                >
                  <Text style={[styles.statusBtnText, statusFilter === st.id && styles.statusBtnTextActive]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Results List */}
        <FlatList
          data={filteredRooms}
          keyExtractor={item => item.room}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={COLORS.textDark} />
              <Text style={styles.emptyStateText}>Seçilen kriterlere uygun derslik bulunamadı.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.roomCard, item.isFullyEmpty ? styles.roomCardEmpty : styles.roomCardBusy]}>
              <View style={styles.roomHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomTitle}>{item.room}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.campus === 'MS' ? 'Mimar Sinan' : 'Yıldırım'}</Text>
                    </View>
                    <View style={styles.badgeSecondary}>
                      <Text style={styles.badgeSecondaryText}>{item.block}</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.statusPill, item.isFullyEmpty ? styles.statusPillEmpty : styles.statusPillBusy]}>
                  <Text style={[styles.statusPillText, item.isFullyEmpty ? { color: COLORS.success } : { color: COLORS.danger }]}>
                    {item.isFullyEmpty ? 'BOŞ' : 'DOLU'}
                  </Text>
                </View>
              </View>

              {item.isFullyEmpty ? (
                <View style={styles.emptyDetails}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.emptyDetailsText}>
                    {selectedDay} günü {pad2(startHour)}:00 - {pad2(endHour)}:00 arası kesintisiz boş
                  </Text>
                </View>
              ) : (
                <View style={styles.busyDetails}>
                  <Text style={styles.busyTitle}>Dolu Saatler ({item.conflicts.length} ders):</Text>
                  <View style={styles.conflictsRow}>
                    {item.conflicts.map((c, i) => (
                      <View key={i} style={styles.conflictChip}>
                        <Text style={styles.conflictChipText}>{c.start || `${c.hour}:00`}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        />
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
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterToggleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
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
  daysContainer: {
    marginBottom: 12,
  },
  daysScroll: {
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 16,
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
  filterPanel: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  pillTextActive: {
    color: '#fff',
  },
  hoursScroll: {
    marginBottom: 12,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  timeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  timeChipText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  timeChipTextActive: {
    color: '#fff',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusBtnActive: {
    backgroundColor: COLORS.cardSecondary,
    borderColor: COLORS.borderLight,
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  statusBtnTextActive: {
    color: COLORS.textPrimary,
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  roomCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    backgroundColor: COLORS.card,
  },
  roomCardEmpty: {
    borderColor: COLORS.successBorder,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  roomCardBusy: {
    borderColor: COLORS.dangerBorder,
    backgroundColor: 'rgba(244, 63, 94, 0.05)',
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  badgeSecondary: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeSecondaryText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPillEmpty: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
  },
  statusPillBusy: {
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.dangerBorder,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyDetailsText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
  },
  busyDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  busyTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.danger,
    marginBottom: 6,
  },
  conflictsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  conflictChip: {
    backgroundColor: COLORS.dangerBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  conflictChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
