import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { askGemini } from '../services/aiService';
import { StorageService } from '../services/storageService';

// Yanıtlardaki **kalın** ve *italik* işaretlerini metin stiline çevirir
function FormattedText({ text, style }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <Text key={i} style={{ fontWeight: '800' }}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <Text key={i} style={{ fontStyle: 'italic', opacity: 0.85 }}>{part.slice(1, -1)}</Text>;
        }
        return part;
      })}
    </Text>
  );
}

const SUGGESTIONS = [
  'Bugün saat 13:00\'te boş sınıf var mı?',
  'Bilgisayar Mühendisliği 1. sınıf dersleri',
  'Ara sınav tarihleri açıklandı mı?',
  'Yıldırım yerleşkesinde boş amfi var mı?'
];

export default function AiAssistantScreen() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Merhaba! Ben BTÜ Kampüs Asistanı 🎓\n\nBölüm ders programları, hoca saatleri, anlık boş sınıflar ve sınav tarihleri hakkında her şeyi bana sorabilirsiniz. Nasıl yardımcı olabilirim?'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const flatListRef = useRef(null);

  useEffect(() => {
    (async () => {
      const savedKey = await StorageService.getApiKey();
      if (savedKey) setCustomKey(savedKey);
    })();
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = () => {
      setIsKeyboardVisible(true);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    const onHide = () => {
      setIsKeyboardVisible(false);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: text
    };

    const history = messages;
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const reply = await askGemini(text, history);
      const aiMsg = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text: reply
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          role: 'assistant',
          text: 'Üzgünüm, yanıt oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.'
        }
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  };

  const saveCustomKey = async () => {
    const trimmed = customKey.trim();
    await StorageService.saveApiKey(trimmed);
    setKeyModalVisible(false);
    if (trimmed) {
      Alert.alert('Başarılı', 'Kişisel Gemini API anahtarınız bu cihaza kaydedildi.');
    } else {
      Alert.alert('Varsayılana Dönüldü', 'Özel anahtar silindi, entegre ortak anahtar kullanılacak.');
    }
  };

  const resetToDefaultKey = async () => {
    setCustomKey('');
    await StorageService.saveApiKey('');
    setKeyModalVisible(false);
    Alert.alert('Varsayılan Mod', 'Özel API anahtarı temizlendi. Entegre ortak API anahtarı aktif.');
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Sohbet temizlendi. BTÜ Kampüsü ile ilgili dilediğinizi sorabilirsiniz!'
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <View style={styles.botAvatarWrap}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </View>
            <View>
              <Text style={styles.title}>Kampüs AI Asistanı</Text>
              <Text style={styles.subtitle}>Gemini 3.1 & Kampüs Motoru</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setKeyModalVisible(true)}>
              <Ionicons name={customKey ? "key" : "key-outline"} size={18} color={customKey ? COLORS.primaryLight : COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={clearChat}>
              <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color={COLORS.primaryLight} />
                <Text style={styles.loadingText}>BTÜ verileri taranıyor & yanıt hazırlanıyor...</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
                {!isUser && (
                  <View style={styles.aiAvatar}>
                    <Text style={styles.aiAvatarText}>AI</Text>
                  </View>
                )}

                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
                  {isUser ? (
                    <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{item.text}</Text>
                  ) : (
                    <FormattedText style={[styles.bubbleText, styles.bubbleTextAi]} text={item.text} />
                  )}
                </View>

                {isUser && (
                  <View style={styles.userAvatar}>
                    <Ionicons name="person" size={12} color="#fff" />
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Quick Suggestion Chips */}
        {messages.length <= 3 && !isLoading && !isKeyboardVisible && (
          <View style={styles.suggestionsWrap}>
            <Text style={styles.suggestionTitle}>Örnek Sorular:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SUGGESTIONS.map((sug, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionChip}
                  onPress={() => handleSend(sug)}
                >
                  <Text style={styles.suggestionChipText}>{sug}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="BTÜ hakkında bir soru sorun..."
            placeholderTextColor={COLORS.textDark}
            value={inputText}
            onChangeText={setInputText}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Modal: Gemini API Key */}
        <Modal
          visible={keyModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setKeyModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="key" size={20} color={COLORS.primaryLight} />
                  <Text style={styles.modalTitle}>Gemini API Ayarı</Text>
                </View>
                <TouchableOpacity onPress={() => setKeyModalVisible(false)}>
                  <Ionicons name="close" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDesc}>
                Uygulamada otomatik paylaşımlı API kotası mevcuttur. Dilerseniz Google AI Studio'dan (aistudio.google.com) alacağınız tamamen ücretsiz kişisel anahtarınızı ekleyerek kota sınırlarına hiç takılmadan kullanabilirsiniz:
              </Text>

              <TextInput
                style={styles.keyInput}
                placeholder="AIzaSy... (Gemini API Key)"
                placeholderTextColor={COLORS.textDark}
                value={customKey}
                onChangeText={setCustomKey}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.modalBtnRow}>
                {customKey ? (
                  <TouchableOpacity style={styles.modalResetBtn} onPress={resetToDefaultKey}>
                    <Text style={styles.modalResetBtnText}>Varsayılana Dön</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.modalSaveBtn} onPress={saveCustomKey}>
                  <Text style={styles.modalSaveBtnText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  botAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messagesContainer: {
    padding: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAi: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiAvatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryLight,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  bubbleTextUser: {
    color: '#fff',
    fontWeight: '500',
  },
  bubbleTextAi: {
    color: COLORS.textSecondary,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 6,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  suggestionsWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  suggestionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  suggestionChip: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
    marginBottom: 14,
  },
  keyInput: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalResetBtn: {
    flex: 1,
    backgroundColor: COLORS.cardSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalResetBtnText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
