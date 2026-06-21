import React from 'react';
import { View, StyleSheet } from 'react-native';
import PageBackHeader from '@/components/PageBackHeader';
import SourcingVendorManager from '@/components/catalog/SourcingVendorManager';
import Colors from '@/constants/colors';

export default function SourcingVendorsScreen() {
  return (
    <View style={styles.screen}>
      <PageBackHeader title="Sourcing Vendors" />
      <SourcingVendorManager />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
});
