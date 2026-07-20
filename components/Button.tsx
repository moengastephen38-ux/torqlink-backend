import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'outline';
}

export default function Button({ title, onPress, loading, variant = 'primary' }: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, variant === 'outline' && styles.outline]}
      onPress={onPress}
      disabled={loading}
    >
      {loading
        ? <ActivityIndicator color={Colors.text} />
        : <Text style={styles.text}>{title}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 8,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  text: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
});