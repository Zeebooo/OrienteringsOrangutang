import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MapSummary } from '@/components/CourseFacts';
import { StepProgress } from '@/components/StepProgress';
import { Colors } from '@/constants/theme';
import { useCreateMap } from '@/context/CreateMapContext';
import { courseLengthInMeters } from '@/utilities/geo';

// Bekräftelse efter publicering. Visar utkastet, som fortfarande finns kvar i contexten.
export default function PublishedScreen() {
	const router = useRouter();
	const { controls, info, isPrivate } = useCreateMap();

	if (!info.difficulty) return <Redirect href="/create" />;

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			{/* Alla fyra steg klara */}
			<StepProgress current={5} total={4} style={styles.steps} />

			<View style={styles.card}>
				<Feather name="check-circle" size={52} color={Colors.light.primary} style={styles.icon} />
				<Text style={styles.title}>{isPrivate ? 'Din karta är sparad!' : 'Din karta är publicerad!'}</Text>
				<Text style={styles.subtitle}>
					{isPrivate ? 'Kartan är bara synlig för dig.' : 'Andra kan nu hitta och testa din bana.'}
				</Text>

				<View style={styles.divider} />

				<MapSummary
					name={info.name}
					description={info.description}
					distanceM={courseLengthInMeters(controls)}
					controlsCount={controls.length}
					difficulty={info.difficulty}
				/>
			</View>

			{/* Kartlistan hämtar om kartorna när den visas, så den nya syns direkt.
			    När flödet lämnas töms utkastet automatiskt (se create/_layout.tsx). */}
			<TouchableOpacity style={styles.button} onPress={() => router.navigate('/')}>
				<Text style={styles.buttonText}>Till kartlistan</Text>
			</TouchableOpacity>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.light.beigeBg,
	},
	content: {
		paddingHorizontal: 16,
		paddingTop: 20,
		paddingBottom: 48,
		gap: 32,
	},
	steps: {
		marginHorizontal: 20,
	},
	card: {
		backgroundColor: Colors.light.cardBg,
		borderRadius: 8,
		paddingTop: 40,
		paddingBottom: 32,
		paddingHorizontal: 16,
	},
	icon: {
		alignSelf: 'center',
		marginBottom: 16,
	},
	title: {
		fontSize: 26,
		fontWeight: '600',
		color: Colors.light.text,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 14,
		color: Colors.light.textMuted,
		textAlign: 'center',
		marginTop: 8,
	},
	divider: {
		height: 1,
		backgroundColor: Colors.light.border,
		marginVertical: 24,
	},
	button: {
		backgroundColor: Colors.light.primary,
		borderWidth: 1,
		borderColor: Colors.light.textMain,
		borderRadius: 12,
		paddingVertical: 16,
		alignItems: 'center',
		marginHorizontal: 40,
	},
	buttonText: {
		color: Colors.light.background,
		fontSize: 20,
		fontWeight: '500',
	},
});
