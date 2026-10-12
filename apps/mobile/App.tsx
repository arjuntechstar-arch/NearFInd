import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '@nearfind/design-tokens';

const categories = ['Fuel', 'EV', 'ATM', 'Hospital', 'Mechanic'];
const services = [
  { name: 'Shell Fuel Station', category: 'Fuel', distance: '1.2 km', status: 'Open 24 hours' },
  { name: 'ChargeGrid Fast EV', category: 'EV Charge', distance: '2.4 km', status: '4 connectors available' },
  { name: 'CityCare Hospital', category: 'Hospital', distance: '3.1 km', status: 'Emergency open' },
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Driver companion</Text>
            <Text style={styles.title}>Find what you need nearby.</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open notifications" style={styles.notificationButton}>
            <Text style={styles.notificationDot}>●</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          accessibilityLabel="Search nearby services"
          placeholder="Search fuel, ATM, hospital…"
          placeholderTextColor={colors.text.muted}
          style={styles.search}
          returnKeyType="search"
        />

        <TouchableOpacity accessibilityRole="button" style={styles.locationButton}>
          <Text style={styles.locationButtonText}>Use my location</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {categories.map((category, index) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={category}
              style={[styles.chip, index === 0 && styles.chipActive]}
            >
              <Text style={[styles.chipText, index === 0 && styles.chipTextActive]}>{category}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>Near your current area</Text>
            <Text style={styles.sectionTitle}>Nearby services</Text>
          </View>
          <TouchableOpacity accessibilityRole="button">
            <Text style={styles.filterText}>Filters</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cards}>
          {services.map((service) => (
            <View key={service.name} style={styles.card}>
              <View style={styles.iconBubble}>
                <Text style={styles.iconText}>{service.category.charAt(0)}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.categoryLabel}>{service.category}</Text>
                <Text style={styles.cardTitle}>{service.name}</Text>
                <Text style={styles.meta}>{service.distance} • {service.status}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Route</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Safety first</Text>
          <Text style={styles.safetyBody}>
            Emergency features will always keep direct local emergency calling available and separate from private roadside assistance.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface.canvas },
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  eyebrow: { color: colors.brand.primaryStrong, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  title: { color: colors.text.primary, fontSize: 30, lineHeight: 36, fontWeight: '700', maxWidth: 300 },
  notificationButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface.card, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { color: colors.brand.primary, fontSize: 20 },
  search: { marginTop: spacing.lg, minHeight: 50, borderRadius: radii.control, borderWidth: 1, borderColor: '#EAD8E7', backgroundColor: colors.surface.card, paddingHorizontal: spacing.md, color: colors.text.primary, fontSize: 16 },
  locationButton: { minHeight: 48, marginTop: spacing.sm, borderRadius: radii.control, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  locationButtonText: { color: colors.text.inverse, fontWeight: '700', fontSize: 15 },
  categoryRow: { gap: spacing.sm, paddingVertical: spacing.md },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.control, borderWidth: 1, borderColor: '#EAD8E7', backgroundColor: colors.surface.card, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.brand.secondary, borderColor: colors.brand.secondary },
  chipText: { color: colors.text.muted, fontWeight: '600' },
  chipTextActive: { color: colors.text.inverse },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { color: colors.text.primary, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  filterText: { color: colors.brand.primaryStrong, fontWeight: '700' },
  cards: { gap: spacing.md, marginTop: spacing.md },
  card: { flexDirection: 'row', gap: 12, borderRadius: radii.card, borderWidth: 1, borderColor: '#EAD8E7', backgroundColor: colors.surface.card, padding: spacing.md },
  iconBubble: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.tertiary },
  iconText: { color: colors.text.inverse, fontSize: 18, fontWeight: '700' },
  cardBody: { flex: 1 },
  categoryLabel: { color: colors.brand.secondary, fontSize: 12, fontWeight: '700' },
  cardTitle: { color: colors.text.primary, fontSize: 17, fontWeight: '700', marginTop: 2 },
  meta: { color: colors.text.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: 12 },
  secondaryButton: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: '#F9DFF0', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.brand.primaryStrong, fontWeight: '700' },
  primaryButton: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colors.text.inverse, fontWeight: '700' },
  safetyCard: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.card, backgroundColor: '#EAF7FC' },
  safetyTitle: { color: '#006C91', fontWeight: '700', fontSize: 16 },
  safetyBody: { color: colors.text.muted, lineHeight: 21, marginTop: 4 },
});
