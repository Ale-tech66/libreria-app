import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function EscanearScreen() {
  return (
    <View style={styles.container}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        ¡Hola! Soy la pantalla de escanear
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});