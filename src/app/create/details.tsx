import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
	ActivityIndicator,
	Image,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
	type ImageSourcePropType,
} from 'react-native';

import { StepProgress } from '@/components/StepProgress';
import { Colors } from '@/constants/theme';
import { useCreateMap } from '@/context/CreateMapContext';
import { createMap } from '@/services/mapsDAL';
import type { Control, Difficulty } from '@/types';
import { courseLengthInMeters } from '@/utilities/geo';

const DISTANCE_ICON = require('@/assets/HiFi/path_distance_icon.png');
const CONTROL_ICON = require('@/assets/HiFi/controll_icon.png');

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
	{ value: 'easy', label: 'Lätt' },
	{ value: 'medium', label: 'Medelsvår' },
	{ value: 'hard', label: 'Svår' },
];

const MAX_NAME_LENGTH = 40;

// Steg 3: banfakta, namn, beskrivning och svårighet – sedan sparas kartan i databasen
export default function MapDetailsScreen() {
	const router = useRouter();
	const { terrain, controls } = useCreateMap();

	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!terrain) return <Redirect href="/create" />;

	const canSave = name.trim().length > 0 && difficulty !== null && !saving;
	const lengthM = courseLengthInMeters(controls);

	async function handleSave() {
		if (!terrain || !difficulty || !canSave) return;
		setSaving(true);
		setError(null);
		try {
			await createMap({
				name: name.trim(),
				description: description.trim(),
				difficulty,
				controls: withDefaultNames(controls),
				terrain,
			});
			// Tillbaka till kartlistan – den hämtar om kartorna när den visas, så den nya syns direkt
			router.navigate('/');
		} catch (e) {
			setError((e as Error).message);
			setSaving(false);
		}
	}

	return (
		<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
			<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
				<StepProgress current={3} total={3} style={styles.steps} />

				{/* Banfakta – räknas ut från kontrollerna, inget användaren fyller i */}
				<View style={styles.factsCard}>
					<Text style={styles.factsTitle}>Banfakta</Text>
					<Text style={styles.factsSubtitle}>Beräknat från din karta</Text>
					<View style={styles.factsRow}>
						<Fact icon={DISTANCE_ICON} text={lengthM !== null ? `${formatKm(lengthM)} km` : '– km'} />
						<Fact icon={CONTROL_ICON} text={`${controls.length} kontroller`} />
					</View>
				</View>

				<Text style={styles.label}>Kartans namn</Text>
				<TextInput
					style={styles.input}
					value={name}
					onChangeText={setName}
					placeholder="Fyll i namn på kartan"
					placeholderTextColor={Colors.light.textMuted}
					maxLength={MAX_NAME_LENGTH}
				/>

				<Text style={styles.label}>Beskrivning</Text>
				<TextInput
					style={[styles.input, styles.multiline]}
					value={description}
					onChangeText={setDescription}
					placeholder="Fyll i en beskrivning för kartan"
					placeholderTextColor={Colors.light.textMuted}
					multiline
				/>

				<Text style={styles.label}>Svårighetsgrad</Text>
				<View style={styles.difficultyRow}>
					{DIFFICULTIES.map((d) => {
						const active = difficulty === d.value;
						return (
							<TouchableOpacity
								key={d.value}
								style={[styles.difficultyButton, active && styles.difficultyButtonActive]}
								onPress={() => setDifficulty(d.value)}
							>
								<Text style={[styles.difficultyText, active && styles.difficultyTextActive]}>{d.label}</Text>
							</TouchableOpacity>
						);
					})}
				</View>

				{error && <Text style={styles.error}>Kunde inte spara: {error}</Text>}

				<TouchableOpacity
					style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
					onPress={handleSave}
					disabled={!canSave}
				>
					{saving ? (
						<ActivityIndicator color={Colors.light.background} />
					) : (
						<Text style={styles.saveButtonText}>Publicera →</Text>
					)}
				</TouchableOpacity>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

function Fact({ icon, text }: { icon: ImageSourcePropType; text: string }) {
	return (
		<View style={styles.fact}>
			<Image source={icon} style={styles.factIcon} />
			<Text style={styles.factText}>{text}</Text>
		</View>
	);
}

const formatKm = (meters: number) => (meters / 1000).toFixed(1).replace('.', ',');

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

const BORDER_COLOR = Colors.light.textMain;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.light.beigeBg,
	},
	content: {
		paddingHorizontal: 24,
		paddingTop: 20,
		paddingBottom: 48,
	},
	steps: {
		marginHorizontal: 12,
		marginBottom: 28,
	},
	factsCard: {
		backgroundColor: Colors.light.cardBg,
		borderRadius: 8,
		paddingVertical: 24,
		paddingHorizontal: 20,
		marginBottom: 12,
	},
	factsTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		color: Colors.light.text,
		marginLeft: 12,
	},
	factsSubtitle: {
		fontSize: 15,
		color: Colors.light.textMain,
		marginLeft: 12,
		marginBottom: 18,
	},
	factsRow: {
		flexDirection: 'row',
		gap: 12,
	},
	fact: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		backgroundColor: Colors.light.beigeBg,
		borderRadius: 12,
		paddingVertical: 16,
	},
	factIcon: {
		width: 20,
		height: 20,
		resizeMode: 'contain',
	},
	factText: {
		fontSize: 16,
		fontWeight: '600',
		color: Colors.light.text,
	},
	label: {
		fontSize: 18,
		fontWeight: 'bold',
		color: Colors.light.text,
		marginTop: 24,
		marginBottom: 12,
	},
	input: {
		backgroundColor: Colors.light.cardBg,
		borderWidth: 1,
		borderColor: BORDER_COLOR,
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 16,
		color: Colors.light.textMain,
	},
	multiline: {
		minHeight: 120,
		textAlignVertical: 'top',
	},
	difficultyRow: {
		flexDirection: 'row',
		gap: 10,
	},
	difficultyButton: {
		flex: 1,
		paddingVertical: 18,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: BORDER_COLOR,
		backgroundColor: Colors.light.cardBg,
		alignItems: 'center',
	},
	difficultyButtonActive: {
		backgroundColor: Colors.light.primary,
		borderColor: Colors.light.primary,
	},
	difficultyText: {
		fontSize: 16,
		color: Colors.light.text,
	},
	difficultyTextActive: {
		color: Colors.light.background,
		fontWeight: '600',
	},
	error: {
		color: Colors.light.danger,
		marginTop: 16,
	},
	saveButton: {
		backgroundColor: Colors.light.primary,
		borderWidth: 1,
		borderColor: BORDER_COLOR,
		borderRadius: 12,
		paddingVertical: 18,
		alignItems: 'center',
		marginTop: 40,
	},
	saveButtonDisabled: {
		opacity: 0.4,
	},
	saveButtonText: {
		color: Colors.light.background,
		fontSize: 22,
		fontWeight: '500',
	},
});
