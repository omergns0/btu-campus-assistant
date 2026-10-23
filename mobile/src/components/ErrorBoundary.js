import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS } from '../theme/colors';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>⚠️ Bir Hata Oluştu</Text>
          <Text style={styles.subtitle}>Uygulama çalışırken beklenmeyen bir hata yakalandı:</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.errorText}>
              {this.state.error?.toString()}
            </Text>
            {this.state.errorInfo?.componentStack && (
              <Text style={styles.stackText}>
                {this.state.errorInfo.componentStack}
              </Text>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.danger,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 250,
    backgroundColor: '#1e1b2e',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    marginBottom: 20,
  },
  errorText: {
    color: '#fda4af',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  stackText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
