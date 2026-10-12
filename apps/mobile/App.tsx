import '@expo/metro-runtime';
import { useMemo, useState } from 'react';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '@nearfind/design-tokens';

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
  };
};

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface NearbyService {
  id: string;
  name: string;
  address: string;
  city: string;
  rating: number;
  reviewCount: number;
  distanceMeters: number;
  category: { slug: string; name: string; icon: string };
}

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<NearbyService[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Location is only requested when you tap the button.');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const visibleServices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return services;
    return services.filter((service) =>
      `${service.name} ${service.category.name} ${service.address} ${service.city}`.toLowerCase().includes(normalized),
    );
  }, [query, services]);

  async function loadCategories(): Promise<Category[]> {
    if (categories.length > 0) return categories;
    const response = await fetch(`${apiBaseUrl}/discovery/categories`);
    if (!response.ok) throw new Error('Unable to load categories');
    const loaded = (await response.json()) as Category[];
    setCategories(loaded);
    return loaded;
  }

  async function loadNearby(lat: number, lng: number, category = activeCategory): Promise<void> {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radiusMeters: '10000',
      limit: '30',
    });
    if (category) params.set('category', category);

    const response = await fetch(`${apiBaseUrl}/discovery/nearby?${params.toString()}`);
    if (!response.ok) throw new Error('Unable to load nearby services');
    setServices((await response.json()) as NearbyService[]);
  }

  async function useMyLocation(): Promise<void> {
    setLoading(true);
    setStatus('Requesting foreground location…');
    try {
      await loadCategories();
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setStatus('Location permission was not granted. You can enable it later in device settings.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextCoords = { lat: location.coords.latitude, lng: location.coords.longitude };
      setCoords(nextCoords);
      await loadNearby(nextCoords.lat, nextCoords.lng);
      setStatus('Showing services near your current location.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load nearby services.');
    } finally {
      setLoading(false);
    }
  }

  async function selectCategory(slug: string): Promise<void> {
    const next = slug === activeCategory ? '' : slug;
    setActiveCategory(next);
    if (!coords) return;
    setLoading(true);
    try {
      await loadNearby(coords.lat, coords.lng, next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to filter nearby services.');
    } finally {
      setLoading(false);
    }
  }

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
          value={query}
          onChangeText={setQuery}
        />

        <TouchableOpacity accessibilityRole="button" style={styles.locationButton} onPress={() => void useMyLocation()} disabled={loading}>
          <Text style={styles.locationButtonText}>{loading ? 'Loading nearby…' : 'Use my location'}</Text>
        </TouchableOpacity>
        <Text accessibilityLiveRegion="polite" style={styles.locationStatus}>{status}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {categories.map((category) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: activeCategory === category.slug }}
              key={category.id}
              onPress={() => void selectCategory(category.slug)}
              style={[styles.chip, activeCategory === category.slug && styles.chipActive]}
            >
              <Text style={[styles.chipText, activeCategory === category.slug && styles.chipTextActive]}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>Near your current area</Text>
            <Text style={styles.sectionTitle}>Nearby services</Text>
          </View>
          <Text style={styles.filterText}>{visibleServices.length} found</Text>
        </View>

        <View style={styles.cards}>
          {visibleServices.map((service) => (
            <View key={service.id} style={styles.card}>
              <View style={styles.iconBubble}>
                <Text style={styles.iconText}>{service.category.name.charAt(0)}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.categoryLabel}>{service.category.name}</Text>
                <Text style={styles.cardTitle}>{service.name}</Text>
                <Text style={styles.meta}>{formatDistance(service.distanceMeters)} • ★ {service.rating.toFixed(1)} ({service.reviewCount})</Text>
                <Text style={styles.meta}>{service.address}, {service.city}</Text>
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

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters / 1000).toFixed(1)} km`;
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
  locationStatus: { color: colors.text.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
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
