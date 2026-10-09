import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import MapView, { Marker, Polyline, type MapPressEvent } from 'react-native-maps';

import { StepProgress } from '@/components/StepProgress';
import { TerrainLayer } from '@/components/TerrainLayer';
import { Colors } from '@/constants/theme';
import { useCreateMap } from '@/context/CreateMapContext';
import type { Control } from '@/types';
import { bboxToRegion } from '@/utilities/bboxToRegion';
import { courseLengthInMeters } from '@/utilities/geo';

// Banan ritas i magenta, som på riktiga orienteringskartor
const COURSE_COLOR = '#C0328A';
const MIN_CONTROLS = 2;

// Steg 2: tryck på kartan för att lägga till en kontroll, tryck på en kontroll för att redigera den
export default function PlaceControlsScreen() {
	const router = useRouter();
	const { terrain, controls, addControl, moveControl, updateControl, removeControl } = useCreateMap();

	const [selectedId, setSelectedId] = useState<string | null>(null);
	// Skiljer en nyss tillagd kontroll från en befintlig som redigeras (styr knapptexten)
	const [isNew, setIsNew] = useState(false);

	// Hamnar man här utan terräng (t.ex. efter en omladdning) börjar man om från steg 1
	if (!terrain) return <Redirect href="/create" />;

	const selectedIndex = controls.findIndex((c) => c.id === selectedId);
	const selected = selectedIndex >= 0 ? controls[selectedIndex] : null;

	function handleMapPress(e: MapPressEvent) {
		// På Android skickas även tryck på en markör till kartan – de ska inte skapa en ny kontroll
		if (e.nativeEvent.action === 'marker-press') return;

		if (selectedId) {
			setSelectedId(null); // ett tryck utanför stänger redigeringen
			return;
		}
		const id = addControl(e.nativeEvent.coordinate);
		setSelectedId(id);
		setIsNew(true);
	}

	function handleMarkerPress(id: string) {
		setSelectedId(id);
		setIsNew(false);
	}

	function handleRemove() {
		if (!selectedId) return;
		removeControl(selectedId);
		setSelectedId(null);
	}

	const lengthM = courseLengthInMeters(controls);

	return (
		<View style={styles.container}>
			<MapView
				style={StyleSheet.absoluteFill}
				showsPointsOfInterests={false}
				initialRegion={bboxToRegion(terrain.bbox)}
				onPress={handleMapPress}
				rotateEnabled={false}
				pitchEnabled={false}
				userInterfaceStyle="light"
			>
				<TerrainLayer terrain={terrain} />

				{/* Linje mellan kontrollerna i den ordning de ska tas */}
				{controls.length >= 2 && <Polyline coordinates={controls} strokeColor={COURSE_COLOR} strokeWidth={3} />}

				{controls.map((control, index) => (
					<Marker
						key={control.id}
						coordinate={control}
						draggable
						onDragEnd={(e) => moveControl(control.id, e.nativeEvent.coordinate)}
						onPress={() => handleMarkerPress(control.id)}
						anchor={{ x: 0.5, y: 0.5 }}
					>
						<View style={[styles.control, control.id === selectedId && styles.controlSelected]}>
							<Text style={[styles.controlNumber, control.id === selectedId && styles.controlNumberSelected]}>
								{index + 1}
							</Text>
						</View>
					</Marker>
				))}
			</MapView>

			<StepProgress current={2} total={4} style={styles.steps} />

			{/* Panelen flyttar upp när tangentbordet visas, så att fälten inte döljs */}
			<KeyboardAvoidingView
				style={styles.panelWrapper}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				pointerEvents="box-none"
			>
				<View style={styles.panel}>
					{selected ? (
						<ControlEditor
							key={selected.id}
							control={selected}
							number={selectedIndex + 1}
							isNew={isNew}
							onChange={(changes) => updateControl(selected.id, changes)}
							onDone={() => setSelectedId(null)}
							onRemove={handleRemove}
						/>
					) : (
						<>
							<Text style={styles.hint}>
								{controls.length === 0
									? 'Tryck på kartan för att placera första kontrollen'
									: 'Tryck på kartan för att lägga till, eller på en kontroll för att ändra den'}
							</Text>
							<Text style={styles.info}>
								{controls.length} kontroller
								{lengthM !== null && ` · ${(lengthM / 1000).toFixed(1).replace('.', ',')} km`}
							</Text>
							<TouchableOpacity
								style={[styles.primaryButton, controls.length < MIN_CONTROLS && styles.primaryButtonDisabled]}
								onPress={() => router.push('/create/details')}
								disabled={controls.length < MIN_CONTROLS}
							>
								<Text style={styles.primaryButtonText}>Nästa</Text>
							</TouchableOpacity>
						</>
					)}
				</View>
			</KeyboardAvoidingView>
		</View>
	);
}

// ─── Redigering av en kontroll ────────────────────────────────────────────

type ControlEditorProps = {
	control: Control;
	number: number;
	isNew: boolean;
	onChange: (changes: Partial<Omit<Control, 'id'>>) => void;
	onDone: () => void;
	onRemove: () => void;
};

function ControlEditor({ control, number, isNew, onChange, onDone, onRemove }: ControlEditorProps) {
	return (
		<>
			<Text style={styles.title}>Kontroll {number}</Text>

			<Text style={styles.label}>Kontrollens namn</Text>
			<TextInput
				style={styles.input}
				value={control.description ?? ''}
				onChangeText={(text) => onChange({ description: text })}
				// Visar namnet kontrollen får om fältet lämnas tomt
				placeholder={`Kontroll ${number}`}
				placeholderTextColor={Colors.light.textMuted}
				maxLength={40}
			/>

			<View style={styles.coordinateRow}>
				<CoordinateInput
					label="Latitud"
					value={control.latitude}
					min={-90}
					max={90}
					onChange={(latitude) => onChange({ latitude })}
				/>
				<CoordinateInput
					label="Longitud"
					value={control.longitude}
					min={-180}
					max={180}
					onChange={(longitude) => onChange({ longitude })}
				/>
			</View>
			<Text style={styles.hintSmall}>Du kan också hålla inne och dra kontrollen på kartan</Text>

			<TouchableOpacity style={styles.primaryButton} onPress={onDone}>
				<Text style={styles.primaryButtonText}>{isNew ? 'Lägg till kontroll' : 'Klar'}</Text>
			</TouchableOpacity>
			<TouchableOpacity style={styles.removeButton} onPress={onRemove}>
				<Text style={styles.removeButtonText}>{isNew ? 'Avbryt' : 'Ta bort kontroll'}</Text>
			</TouchableOpacity>
		</>
	);
}

type CoordinateInputProps = {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: (value: number) => void;
};

/**
 * Ett fält för en koordinat. Medan man skriver visas det man skrivit (även ofärdiga tal som "63,8").
 * När fältet inte används visas kontrollens aktuella värde – så det uppdateras om man drar kontrollen.
 */
function CoordinateInput({ label, value, min, max, onChange }: CoordinateInputProps) {
	const [text, setText] = useState<string | null>(null);

	function handleChange(newText: string) {
		setText(newText);
		const parsed = Number(newText.replace(',', '.'));
		// Uppdatera bara positionen när det är ett giltigt tal – kontrollen flyttas direkt på kartan
		if (newText.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
			onChange(parsed);
		}
	}

	return (
		<View style={styles.coordinate}>
			<Text style={styles.label}>{label}</Text>
			<TextInput
				style={styles.input}
				value={text ?? value.toFixed(6)}
				onFocus={() => setText(value.toFixed(6))}
				onChangeText={handleChange}
				onBlur={() => setText(null)}
				keyboardType="numbers-and-punctuation"
				selectTextOnFocus
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	steps: {
		position: 'absolute',
		top: 16,
		left: 48,
		right: 48,
	},
	control: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 3,
		borderColor: COURSE_COLOR,
		backgroundColor: 'white',
		justifyContent: 'center',
		alignItems: 'center',
	},
	controlSelected: {
		backgroundColor: COURSE_COLOR,
	},
	controlNumber: {
		fontWeight: 'bold',
		color: COURSE_COLOR,
	},
	controlNumberSelected: {
		color: 'white',
	},
	panelWrapper: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
	},
	panel: {
		backgroundColor: Colors.light.cardBg,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingHorizontal: 20,
		paddingTop: 20,
		paddingBottom: 36,
		gap: 10,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 10,
	},
	title: {
		fontSize: 18,
		fontWeight: 'bold',
		color: Colors.light.textMain,
	},
	label: {
		fontSize: 14,
		fontWeight: 'bold',
		color: Colors.light.textMain,
		marginBottom: 6,
	},
	input: {
		borderWidth: 1,
		borderColor: Colors.light.textMain,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 15,
		color: Colors.light.textMain,
	},
	coordinateRow: {
		flexDirection: 'row',
		gap: 12,
	},
	coordinate: {
		flex: 1,
	},
	hint: {
		fontSize: 16,
		textAlign: 'center',
		color: Colors.light.textMain,
	},
	hintSmall: {
		fontSize: 12,
		color: Colors.light.textMuted,
	},
	info: {
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
		color: Colors.light.textMuted,
	},
	primaryButton: {
		backgroundColor: Colors.light.primary,
		borderRadius: 10,
		paddingVertical: 16,
		alignItems: 'center',
		marginTop: 6,
	},
	primaryButtonDisabled: {
		backgroundColor: '#CCC',
	},
	primaryButtonText: {
		color: Colors.light.background,
		fontSize: 18,
		fontWeight: '600',
	},
	removeButton: {
		alignItems: 'center',
		paddingVertical: 6,
	},
	removeButtonText: {
		color: Colors.light.danger,
		fontSize: 15,
		fontWeight: '600',
	},
});
