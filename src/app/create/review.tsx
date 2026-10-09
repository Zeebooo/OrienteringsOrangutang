import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MapSummary } from '@/components/CourseFacts';
import { StepProgress } from '@/components/StepProgress';
import { Colors } from '@/constants/theme';
import { useCreateMap } from '@/context/CreateMapContext';
import { createMap } from '@/services/mapsDAL';
import type { Control } from '@/types';
import { courseLengthInMeters } from '@/utilities/geo';

const VISIBILITY_OPTIONS = [
	{ isPrivate: true, title: 'Bara jag', subtitle: 'Kartan är endast synlig för dig' },
	{ isPrivate: false, title: 'Alla', subtitle: 'Kartan blir synlig för alla' },
];

// Steg 4: granska kartan, välj vem som ser den och publicera
export default function ReviewMapScreen() {
	const router = useRouter();
	const { terrain, controls, info, isPrivate, setIsPrivate } = useCreateMap();

	const [publishing, setPublishing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Saknas något från tidigare steg (t.ex. efter en omladdning) börjar man om
	if (!terrain || !info.difficulty) return <Redirect href="/create" />;
	const difficulty = info.difficulty;

	const canPublish = isPrivate !== null && !publishing;

	async function handlePublish() {
		if (!terrain || isPrivate === null || !canPublish) return;
		setPublishing(true);
		setError(null);
		try {
			await createMap({
				name: info.name,
				description: info.description,
				difficulty,
				controls: withDefaultNames(controls),
				terrain,
				isPrivate,
			});
			// replace: tillbaka-knappen ska inte leda till granskningen igen
			router.replace('/create/published');
		} catch (e) {
			setError((e as Error).message);
			setPublishing(false);
		}
	}

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<StepProgress current={4} total={4} style={styles.steps} />

			<View style={styles.card}>
				<MapSummary
					name={info.name}
					description={info.description}
					distanceM={courseLengthInMeters(controls)}
					controlsCount={controls.length}
					difficulty={difficulty}
				/>
			</View>

			<View style={styles.card}>
				<Text style={styles.question}>Vem kan se kartan?</Text>
				{VISIBILITY_OPTIONS.map((option) => {
					const selected = isPrivate === option.isPrivate;
					return (
						<TouchableOpacity
							key={option.title}
							style={[styles.option, selected && styles.optionSelected]}
							onPress={() => setIsPrivate(option.isPrivate)}
							accessibilityRole="radio"
							accessibilityState={{ checked: selected }}
						>
							<View style={styles.radio}>{selected && <View style={styles.radioDot} />}</View>
							<View>
								<Text style={styles.optionTitle}>{option.title}</Text>
								<Text style={styles.optionSubtitle}>{option.subtitle}</Text>
							</View>
						</TouchableOpacity>
					);
				})}
			</View>

			{error && <Text style={styles.error}>Kunde inte publicera: {error}</Text>}

			<TouchableOpacity
				style={[styles.button, !canPublish && styles.buttonDisabled]}
				onPress={handlePublish}
				disabled={!canPublish}
			>
				{publishing ? (
					<ActivityIndicator color={Colors.light.background} />
				) : (
					<Text style={styles.buttonText}>Publicera karta →</Text>
				)}
			</TouchableOpacity>
		</ScrollView>
	);
}

/**
 * Kontroller utan namn får "Kontroll 1", "Kontroll 2" … efter sin plats i banan.
 * Görs först när kartan sparas, så att numret stämmer även om kontroller tagits bort på vägen.
 */
function withDefaultNames(controls: Control[]): Control[] {
	return controls.map((control, index) => ({
		...control,
		description: control.description?.trim() || `Kontroll ${index + 1}`,
	}));
}

const RADIO_SIZE = 26;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.light.beigeBg,
	},
	content: {
		paddingHorizontal: 16,
		paddingTop: 20,
		paddingBottom: 48,
		gap: 20,
	},
	steps: {
		marginHorizontal: 20,
		marginBottom: 8,
	},
	card: {
		backgroundColor: Colors.light.cardBg,
		borderRadius: 8,
		paddingVertical: 24,
		paddingHorizontal: 16,
	},
	question: {
		fontSize: 18,
		fontWeight: '600',
		color: Colors.light.text,
		marginLeft: 12,
		marginBottom: 12,
	},
	option: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		paddingVertical: 14,
		paddingHorizontal: 12,
		borderRadius: 8,
	},
	optionSelected: {
		backgroundColor: Colors.light.beigeBg,
	},
	radio: {
		width: RADIO_SIZE,
		height: RADIO_SIZE,
		borderRadius: RADIO_SIZE / 2,
		borderWidth: 2,
		borderColor: Colors.light.primary,
		justifyContent: 'center',
		alignItems: 'center',
	},
	radioDot: {
		width: RADIO_SIZE / 2.2,
		height: RADIO_SIZE / 2.2,
		borderRadius: RADIO_SIZE,
		backgroundColor: Colors.light.primary,
	},
	optionTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: Colors.light.text,
	},
	optionSubtitle: {
		fontSize: 13,
		color: Colors.light.textMuted,
	},
	error: {
		color: Colors.light.danger,
		textAlign: 'center',
	},
	button: {
		backgroundColor: Colors.light.primary,
		borderWidth: 1,
		borderColor: Colors.light.textMain,
		borderRadius: 12,
		paddingVertical: 16,
		alignItems: 'center',
		marginHorizontal: 24,
		marginTop: 12,
	},
	buttonDisabled: {
		opacity: 0.4,
	},
	buttonText: {
		color: Colors.light.background,
		fontSize: 20,
		fontWeight: '500',
	},
});
