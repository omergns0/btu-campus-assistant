import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { COLORS } from '../theme/colors';
import { StorageService } from '../services/storageService';

// Her ekranın üstünde görünen kalıcı uyarı şeridi
export function DisclaimerBanner() {
  return (
    <View style={styles.banner} accessibilityRole="text">
      <Text style={styles.bannerText}>
        ⚠️ <Text style={styles.bannerStrong}>Öğrenci projesidir, BTÜ ile resmi bağlantısı yoktur.</Text>
        {' '}Test aşamasındayız, hatalar olabilir. Ders ve sınav saatlerinizi okulun resmi kaynaklarından kontrol ediniz.
      </Text>
    </View>
  );
}

// İlk açılışta gösterilen, "Anladım" ile kapanan bilgilendirme penceresi
export function DisclaimerModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    StorageService.getDisclaimerAck().then(ack => {
      if (!ack) setVisible(true);
    });
  }, []);

  const accept = () => {
    setVisible(false);
    StorageService.saveDisclaimerAck();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={accept}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.iconWrap}>
              <Text style={{ fontSize: 22 }}>⚠️</Text>
            </View>
            <Text style={styles.title}>Önemli Bilgilendirme</Text>
          </View>

          <Text style={styles.item}>
            🎓 Bu uygulama bir <Text style={styles.strong}>öğrenci projesidir</Text>.{' '}
            <Text style={styles.strong}>Bursa Teknik Üniversitesi ile hiçbir resmi bağlantısı yoktur.</Text>
          </Text>
          <Text style={styles.item}>
            🧪 Henüz <Text style={styles.strong}>test aşamasında</Text> bir uygulamayız; verilerde{' '}
            <Text style={styles.strong}>hatalar olabilir</Text>.
          </Text>
          <Text style={styles.item}>
            📅 Ders ve sınav saatlerinizi mutlaka <Text style={styles.strong}>okulun resmi kaynaklarından</Text> kontrol ediniz.
          </Text>

          <TouchableOpacity style={styles.button} onPress={accept}>
            <Text style={styles.buttonText}>Anladım</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.warningBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.warningBorder,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  bannerText: {
    fontSize: 10.5,
    lineHeight: 14,
    color: '#fde68a',
  },
  bannerStrong: {
    fontWeight: '800',
    color: '#fef3c7',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    padding: 20,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  item: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
  strong: {
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  button: {
    marginTop: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
