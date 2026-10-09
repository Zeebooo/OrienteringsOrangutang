import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

import { ControlsFact, DIFFICULTY_LABELS, DistanceFact } from '@/components/CourseFacts';
import { StepProgress } from '@/components/StepProgress';
import { Colors } from '@/constants/theme';
import { useCreateMap } from '@/context/CreateMapContext';
import type { Difficulty } from '@/types';
import { courseLengthInMeters } from '@/utilities/geo';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const MAX_NAME_LENGTH = 40;

// Steg 3: banfakta, namn, beskrivning och svårighet. Sparas i utkastet – själva publiceringen sker i steg 4.
export default function MapDetailsScreen() {
	const router = useRouter();
	const { terrain, controls, info, setInfo } = useCreateMap();

	// Startvärden från utkastet, så att inget försvinner om man går tillbaka från steg 4
	const [name, setName] = useState(info.name);
	const [description, setDescription] = useState(info.description);
	const [difficulty, setDifficulty] = useState<Difficulty | null>(info.difficulty);

	if (!terrain) return <Redirect href="/create" />;

	const canContinue = name.trim().length > 0 && difficulty !== null;
	const lengthM = courseLengthInMeters(controls);

	function handleNext() {
		if (!canContinue) return;
		setInfo({ name: name.trim(), description: description.trim(), difficulty });
		router.push('/create/review');
	}

	return (
		<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
			<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
				<StepProgress current={3} total={4} style={styles.steps} />

				{/* Banfakta – räknas ut från kontrollerna, inget användaren fyller i */}
				<View style={styles.factsCard}>
					<Text style={styles.factsTitle}>Banfakta</Text>
					<Text style={styles.factsSubtitle}>Beräknat från din karta</Text>
					<View style={styles.factsRow}>
						<DistanceFact meters={lengthM} />
						<ControlsFact count={controls.length} />
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
						const active = difficulty === d;
						return (
							<TouchableOpacity
								key={d}
								style={[styles.difficultyButton, active && styles.difficultyButtonActive]}
								onPress={() => setDifficulty(d)}
							>
								<Text style={[styles.difficultyText, active && styles.difficultyTextActive]}>
									{DIFFICULTY_LABELS[d]}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>

				<TouchableOpacity
					style={[styles.nextButton, !canContinue && styles.nextButtonDisabled]}
					onPress={handleNext}
					disabled={!canContinue}
				>
					<Text style={styles.nextButtonText}>Nästa →</Text>
				</TouchableOpacity>
			</ScrollView>
		</KeyboardAvoidingView>
	);
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
	nextButton: {
		backgroundColor: Colors.light.primary,
		borderWidth: 1,
		borderColor: BORDER_COLOR,
		borderRadius: 12,
		paddingVertical: 18,
		alignItems: 'center',
		marginTop: 40,
	},
	nextButtonDisabled: {
		opacity: 0.4,
	},
	nextButtonText: {
		color: Colors.light.background,
		fontSize: 22,
		fontWeight: '500',
	},
});
