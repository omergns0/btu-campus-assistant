import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Linking,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { cleanStr, getExamCountdown, parseExamDate, matchPlanToExams } from '../utils/helpers';
import { StorageService } from '../services/storageService';
import { usePlan } from '../context/PlanContext';
import examsData from '../data/exams.json';

const STATUS_ORDER = { FINAL: 0, DRAFT: 1, PENDING: 2 };

const DEPT_LIST = Object.entries(examsData.departments || {})
  .filter(([k]) => k !== '_genel')
  .map(([key, d]) => ({
    ...d,
    key,
    status: d.status || (d.has_announcement ? 'FINAL' : 'PENDING')
  }));

function deptExamItems(dept) {
  const ann = (dept.announcements || [])[0];
  return [...((ann && ann.exam_items) || [])].sort((a, b) => {
    const da = parseExamDate(a.date, a.time);
    const db = parseExamDate(b.date, b.time);
    return (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity);
  });
}

// Duyuru adreslerinde Türkçe karakterler kodlanmamış olabiliyor
function openLink(url) {
  if (!url) return;
  let safe = url;
  try { safe = encodeURI(decodeURI(url)); } catch (e) { safe = encodeURI(url); }
  Linking.openURL(safe).catch(() => {});
}

export default function ExamsScreen() {
  const { plannedCourses } = usePlan();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, FINAL, DRAFT, PENDING, MY
  const [expandedDeptKey, setExpandedDeptKey] = useState(null);
  const [myDeptKey, setMyDeptKey] = useState(null);

  useEffect(() => {
    StorageService.getFavoriteDepartment().then(k => {
      if (k && examsData.departments?.[k]) setMyDeptKey(k);
    });
  }, []);

  const toggleMyDept = (key) => {
    const next = myDeptKey === key ? null : key;
    setMyDeptKey(next);
    StorageService.saveFavoriteDepartment(next);
  };

  const counts = useMemo(() => ({
    FINAL: DEPT_LIST.filter(d => d.status === 'FINAL').length,
    DRAFT: DEPT_LIST.filter(d => d.status === 'DRAFT').length,
    PENDING: DEPT_LIST.filter(d => d.status === 'PENDING').length,
  }), []);

  // Taslaktaki derslerin yaklaşan sınavları (başlangıcından 4 saat geçene kadar gösterilir)
  const myExams = useMemo(() => {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000;
    return matchPlanToExams(plannedCourses, examsData, myDeptKey).filter(ex => {
      const dt = parseExamDate(ex.date, ex.time);
      return !dt || dt.getTime() > cutoff;
    });
  }, [plannedCourses, myDeptKey]);

  const filteredDepts = useMemo(() => {
    const q = cleanStr(searchQuery);
    const qCode = q.replace(/\s+/g, '');
    return DEPT_LIST.filter(dept => {
      if (statusFilter === 'MY' && dept.key !== myDeptKey) return false;
      if (['FINAL', 'DRAFT', 'PENDING'].includes(statusFilter) && dept.status !== statusFilter) return false;
      if (!q) return true;
      return cleanStr(dept.name).includes(q) ||
        cleanStr(dept.faculty).includes(q) ||
        (dept.announcements || []).some(ann =>
          cleanStr(ann.title).includes(q) ||
          (ann.exam_items || []).some(it =>
            cleanStr(it.code).replace(/\s+/g, '').includes(qCode) ||
            cleanStr(it.name).includes(q) ||
            cleanStr(it.instructor).includes(q)
          )
        );
    }).sort((a, b) => {
      if (a.key === myDeptKey) return -1;
      if (b.key === myDeptKey) return 1;
      return (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2) || a.name.localeCompare(b.name, 'tr');
    });
  }, [searchQuery, statusFilter, myDeptKey]);

  const meta = examsData.meta || {};
  const myDeptName = myDeptKey ? examsData.departments[myDeptKey]?.name : null;

  const header = (
    <View style={{ gap: 10, marginBottom: 4 }}>
      <View style={styles.announcementBox}>
        <View style={styles.annTitleRow}>
          <Ionicons name="alarm-outline" size={16} color={COLORS.primaryLight} />
          <Text style={styles.annTitle}>Sınavlarım</Text>
        </View>
        <Text style={styles.annDate}>
          {myDeptName ? `Bölümüm: ${myDeptName}` : 'Bölüm seçmek için bir bölüm kartındaki ☆ simgesine dokunun.'}
        </Text>
        {plannedCourses.length === 0 ? (
          <Text style={styles.notAnnouncedText}>
            Taslak sekmesine aldığınız dersleri ekleyin; sınavları burada geri sayımla listelenir.
          </Text>
        ) : myExams.length === 0 ? (
          <Text style={styles.notAnnouncedText}>Taslağınızdaki dersler için yaklaşan sınav bulunamadı.</Text>
        ) : (
          myExams.slice(0, 8).map((ex, i) => {
            const countdown = getExamCountdown(ex.date);
            return (
              <View key={`${ex.code}_${ex.date}_${i}`} style={styles.examItemRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.examItemTop}>
                    <Text style={styles.examCode}>{ex.code}</Text>
                    <Text style={styles.examDateTime}>{ex.date}{ex.time ? ` • ${ex.time}` : ''}</Text>
                  </View>
                  <Text style={styles.examName}>{ex.name}</Text>
                  <Text style={styles.examRooms}>
                    {ex.classrooms ? `Derslik: ${ex.classrooms}` : 'Derslik açıklanacak'}{myDeptKey ? '' : ` • ${ex.deptName}`}
                  </Text>
                </View>
                {countdown && (
                  <View style={[styles.countdownBadge, { borderColor: countdown.color }]}>
                    <Text style={[styles.countdownText, { color: countdown.color }]}>{countdown.text}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Sınav Takvimi</Text>
            <Text style={styles.subtitle}>
              {meta.term || '2026-2027'} {meta.exam_type || 'Ara Sınav (Vize)'}
            </Text>
            {meta.last_updated ? <Text style={styles.subtitle}>Son tarama: {meta.last_updated}</Text> : null}
          </View>

          <View style={styles.termBadge}>
            <Text style={styles.termBadgeText}>{counts.FINAL + counts.DRAFT}/{DEPT_LIST.length} Yayında</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textDark} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Bölüm, ders kodu veya hoca ara (örn: MAT0101)..."
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

        {/* Filter Tabs */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {[
              { id: 'ALL', label: `Tümü (${DEPT_LIST.length})` },
              { id: 'FINAL', label: `Kesinleşen (${counts.FINAL})` },
              { id: 'DRAFT', label: `Taslak (${counts.DRAFT})` },
              { id: 'PENDING', label: `Bekleyen (${counts.PENDING})` },
              ...(myDeptKey ? [{ id: 'MY', label: '★ Bölümüm' }] : [])
            ].map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, statusFilter === f.id && styles.filterChipActive]}
                onPress={() => setStatusFilter(f.id)}
              >
                <Text style={[styles.filterChipText, statusFilter === f.id && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Department / Exam List */}
        <FlatList
          data={filteredDepts}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={searchQuery ? null : header}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textDark} />
              <Text style={styles.emptyTitle}>Sınav Takvimi Bulunamadı</Text>
              <Text style={styles.emptyDesc}>Arama kriterinize uygun sınav kaydı bulunamadı.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isExpanded = expandedDeptKey === item.key;
            const isMine = item.key === myDeptKey;
            const ann = (item.announcements || [])[0] || null;
            const allExamItems = isExpanded ? deptExamItems(item) : [];
            const files = (ann && ann.files) || [];

            let badgeBg = 'rgba(100, 116, 139, 0.15)';
            let badgeText = COLORS.textMuted;
            if (item.status === 'FINAL') {
              badgeBg = COLORS.successBg;
              badgeText = COLORS.success;
            } else if (item.status === 'DRAFT') {
              badgeBg = COLORS.warningBg;
              badgeText = COLORS.warning;
            }

            return (
              <View style={[styles.deptCard, isMine && { borderColor: COLORS.primaryLight }]}>
                <TouchableOpacity
                  style={styles.deptCardHeader}
                  onPress={() => setExpandedDeptKey(isExpanded ? null : item.key)}
                >
                  <TouchableOpacity onPress={() => toggleMyDept(item.key)} hitSlop={10} style={{ marginRight: 10 }}>
                    <Ionicons name={isMine ? 'star' : 'star-outline'} size={20} color={isMine ? COLORS.warning : COLORS.textDark} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deptName}>{item.name}</Text>
                    <Text style={styles.facultyName} numberOfLines={1}>{item.faculty}</Text>
                  </View>

                  <View style={styles.headerRight}>
                    <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.statusBadgeText, { color: badgeText }]}>
                        {item.status_label || 'Açıklanmadı'}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={COLORS.textMuted}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.deptBody}>
                    {ann ? (
                      <View style={styles.announcementBox}>
                        <View style={styles.annTitleRow}>
                          <Ionicons name="megaphone-outline" size={16} color={COLORS.primaryLight} />
                          <Text style={styles.annTitle} numberOfLines={2}>{ann.title}</Text>
                        </View>
                        <Text style={styles.annDate}>Yayın Tarihi: {ann.date}</Text>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {files.slice(0, 3).map((f, i) => (
                            <TouchableOpacity key={i} style={styles.openUrlBtn} onPress={() => openLink(f.url)}>
                              <Text style={styles.openUrlText}>{(f.ext || 'PDF').toUpperCase()} Belgesi</Text>
                              <Ionicons name="document-outline" size={13} color={COLORS.primaryLight} />
                            </TouchableOpacity>
                          ))}
                          {ann.url && (
                            <TouchableOpacity style={styles.openUrlBtn} onPress={() => openLink(ann.url)}>
                              <Text style={styles.openUrlText}>Resmi Duyuru</Text>
                              <Ionicons name="open-outline" size={13} color={COLORS.primaryLight} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.notAnnizedBox}>
                        <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
                        <Text style={styles.notAnnouncedText}>
                          Bu bölüm için sınav takvimi henüz duyurulmadı.
                        </Text>
                        {item.url ? (
                          <TouchableOpacity onPress={() => openLink(item.url)}>
                            <Text style={styles.openUrlText}>Bölüm sayfası ↗</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}

                    {allExamItems.length > 0 && (
                      <View style={styles.examItemsList}>
                        <Text style={styles.examItemsHeader}>Sınavlar ({allExamItems.length} Ders, tarihe göre):</Text>
                        {allExamItems.map((ex, i) => {
                          const countdown = getExamCountdown(ex.date);
                          const isPast = countdown && countdown.days < 0;
                          return (
                            <View key={i} style={[styles.examItemRow, isPast && { opacity: 0.5 }]}>
                              <View style={{ flex: 1 }}>
                                <View style={styles.examItemTop}>
                                  <Text style={styles.examCode}>{ex.code}</Text>
                                  <Text style={styles.examDateTime}>
                                    {ex.date} {ex.time ? `• ${ex.time}` : ''}
                                  </Text>
                                </View>
                                <Text style={styles.examName}>
                                  {ex.name}{ex.grade ? ` (${ex.grade}. Sınıf)` : ''}
                                </Text>
                                {ex.classrooms ? (
                                  <Text style={styles.examRooms}>Derslik: {ex.classrooms}</Text>
                                ) : null}
                                {ex.instructor ? (
                                  <Text style={styles.examRooms}>{ex.instructor}</Text>
                                ) : null}
                              </View>

                              {countdown && (
                                <View style={[styles.countdownBadge, { borderColor: countdown.color }]}>
                                  <Text style={[styles.countdownText, { color: countdown.color }]}>
                                    {countdown.text}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
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
  termBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  termBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  deptCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  deptCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  deptName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  facultyName: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  deptBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  announcementBox: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  annTitleRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  annTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 16,
  },
  annDate: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  openUrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  openUrlText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primaryLight,
  },
  notAnnizedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
  },
  notAnnouncedText: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
  },
  examItemsList: {
    marginTop: 12,
    gap: 8,
  },
  examItemsHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  examItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  examItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  examCode: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryLight,
  },
  examDateTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  examName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  examRooms: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  countdownBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  countdownText: {
    fontSize: 10,
    fontWeight: '800',
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
});
