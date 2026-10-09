import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useCreateMap } from '@/context/CreateMapContext';
import { createMap } from '@/services/mapsDAL';
import type { Difficulty } from '@/types';
import { courseLengthInMeters } from '@/utilities/geo';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
	{ value: 'easy', label: 'Lätt' },
	{ value: 'medium', label: 'Medelsvår' },
	{ value: 'hard', label: 'Svår' },
];

const MAX_NAME_LENGTH = 40;

// Steg 3: namn, beskrivning och svårighet – sedan sparas kartan i databasen
export default function MapDetailsScreen() {
	const router = useRouter();
	const { terrain, controls } = useCreateMap();

	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [difficulty, setDifficulty] = useState<Difficulty>('easy');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!terrain) return <Redirect href="/create" />;

	const canSave = name.trim().length > 0 && !saving;
	const lengthM = courseLengthInMeters(controls);

	async function handleSave() {
		if (!terrain || !canSave) return;
		setSaving(true);
		setError(null);
		try {
			await createMap({
				name: name.trim(),
				description: description.trim(),
				difficulty,
				controls,
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
				<Text style={styles.summary}>
					{controls.length} kontroller
					{lengthM !== null && ` · ${(lengthM / 1000).toFixed(1).replace('.', ',')} km`}
				</Text>

				<Text style={styles.label}>Namn</Text>
				<TextInput
					style={styles.input}
					value={name}
					onChangeText={setName}
					placeholder="T.ex. Campusrundan"
					placeholderTextColor={Colors.light.textMuted}
					maxLength={MAX_NAME_LENGTH}
					autoFocus
				/>

				<Text style={styles.label}>Beskrivning</Text>
				<TextInput
					style={[styles.input, styles.multiline]}
					value={description}
					onChangeText={setDescription}
					placeholder="Vad ska löparen veta om banan?"
					placeholderTextColor={Colors.light.textMuted}
					multiline
				/>

				<Text style={styles.label}>Svårighetsgrad</Text>
				<View style={styles.difficultyRow}>
					{DIFFICULTIES.map((d) => (
						<TouchableOpacity
							key={d.value}
							style={[styles.difficultyButton, difficulty === d.value && styles.difficultyButtonActive]}
							onPress={() => setDifficulty(d.value)}
						>
							<Text style={[styles.difficultyText, difficulty === d.value && styles.difficultyTextActive]}>
								{d.label}
							</Text>
						</TouchableOpacity>
					))}
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
						<Text style={styles.saveButtonText}>Publicera karta</Text>
					)}
				</TouchableOpacity>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.light.beigeBg,
	},
	content: {
		padding: 20,
		gap: 8,
	},
	summary: {
		fontSize: 14,
		fontWeight: '600',
		color: Colors.light.textMuted,
		marginBottom: 8,
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: Colors.light.textMain,
		marginTop: 12,
	},
	input: {
		backgroundColor: Colors.light.cardBg,
		borderWidth: 1,
		borderColor: Colors.light.border,
		borderRadius: 12,
		padding: 14,
		fontSize: 16,
		color: Colors.light.textMain,
	},
	multiline: {
		minHeight: 100,
		textAlignVertical: 'top',
	},
	difficultyRow: {
		flexDirection: 'row',
		gap: 8,
	},
	difficultyButton: {
		flex: 1,
		paddingVertical: 12,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: Colors.light.border,
		backgroundColor: Colors.light.cardBg,
		alignItems: 'center',
	},
	difficultyButtonActive: {
		backgroundColor: Colors.light.primary,
		borderColor: Colors.light.primary,
	},
	difficultyText: {
		fontWeight: '600',
		color: Colors.light.textMain,
	},
	difficultyTextActive: {
		color: Colors.light.background,
	},
	error: {
		color: Colors.light.danger,
		marginTop: 12,
	},
	saveButton: {
		backgroundColor: Colors.light.primary,
		borderRadius: 12,
		paddingVertical: 16,
		alignItems: 'center',
		marginTop: 24,
	},
	saveButtonDisabled: {
		backgroundColor: '#CCC',
	},
	saveButtonText: {
		color: Colors.light.background,
		fontSize: 16,
		fontWeight: 'bold',
	},
});
