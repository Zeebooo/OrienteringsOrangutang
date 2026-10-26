import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
	type HostInstance,
} from 'react-native';
import MapView, { Marker, Polyline, type MapPressEvent, type Region } from 'react-native-maps';
import { captureRef } from 'react-native-view-shot';

import { StepProgress } from '@/components/StepProgress';
import { TerrainLayer } from '@/components/TerrainLayer';
import { Colors } from '@/constants/theme';
import { useCreateMap } from '@/context/CreateMapContext';
import type { BoundingBox, Control, Coordinate } from '@/types';
import { bboxToRegion } from '@/utilities/bboxToRegion';
import { bboxCorners, clampToBbox, courseLengthInMeters, distanceInMeters, isInsideBbox } from '@/utilities/geo';

// Banan ritas i magenta, som på riktiga orienteringskartor
const COURSE_COLOR = '#C0328A';
// Knallorange så att kanten syns mot både grön terräng och grå byggnader (samma orange som kontrollerna i kartvyn)
const AREA_BORDER_COLOR = '#FF6B00';
const MIN_CONTROLS = 2;

// Bilden till kartlistan: bredd i pixlar, och hur länge terrängen får på sig att ritas innan den tas
const THUMBNAIL_WIDTH = 300;
const TERRAIN_RENDER_DELAY_MS = 2000;
// Längsta tid kontrollerna kan vara låsta, ifall kartan aldrig blir redo
const MAX_CAPTURE_WAIT_MS = 6000;

// Tryck inom så här många pixlar från en kontroll räknas som ett tryck på kontrollen.
// Kontrollen är 32 px bred, så det är dess radie plus lite marginal för fingret.
const CONTROL_TAP_RADIUS_PX = 24;
const METERS_PER_DEGREE_LAT = 111_320;
// Två tryck så här tätt efter varandra räknas som samma tryck
const DUPLICATE_PRESS_MS = 400;

// Steg 2: tryck på kartan för att lägga till en kontroll, tryck på en kontroll för att redigera den
export default function PlaceControlsScreen() {
	const router = useRouter();
	const { terrain, controls, addControl, moveControl, updateControl, removeControl, setThumbnail } = useCreateMap();

	const [selectedId, setSelectedId] = useState<string | null>(null);
	// Skiljer en nyss tillagd kontroll från en befintlig som redigeras (styr knapptexten)
	const [isNew, setIsNew] = useState(false);
	// Visar en varning när man tryckt utanför området
	const [tappedOutside, setTappedOutside] = useState(false);

	// --- Bild på terrängen till kartlistan ---
	// Vyn runt kartan fotograferas. Stegindikatorn och panelen ligger utanför den och kommer inte med.
	// HostInstance: sedan React Native 0.87 är View en funktion, så refen pekar på den inbyggda vyn
	const mapContainerRef = useRef<HostInstance>(null);
	const mapSizeRef = useRef<{ width: number; height: number } | null>(null);
	const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Vad kartan visar just nu (för att räkna om pixlar till meter) och när senaste kontrollen skapades
	const regionRef = useRef<Region | null>(null);
	const lastAddedAtRef = useRef(0);

	// Medan bilden tas går det inte att lägga ut kontroller, så att de inte kommer med på bilden.
	// Finns det redan kontroller (t.ex. när man kommer tillbaka till steget) tas ingen ny bild.
	const [capturing, setCapturing] = useState(controls.length === 0);

	useEffect(() => {
		// Spärr: blir kartan aldrig redo ska man ändå kunna fortsätta – då används bilden från "Välj område"
		// (Har bilden redan börjat tas låses kontrollerna upp när den är klar i stället.)
		const fallbackTimer = setTimeout(() => {
			if (!snapshotTimerRef.current) setCapturing(false);
		}, MAX_CAPTURE_WAIT_MS);

		// Lämnar man steget innan bilden tagits ska den inte tas
		return () => {
			clearTimeout(fallbackTimer);
			if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
		};
	}, []);

	function handleMapReady() {
		if (!capturing) return;

		// Kartan är redo, men kartbilderna och terrängen behöver en stund till för att ritas
		snapshotTimerRef.current = setTimeout(async () => {
			const size = mapSizeRef.current;
			try {
				if (size) {
					const base64 = await captureRef(mapContainerRef, {
						format: 'jpg',
						quality: 0.7,
						result: 'base64',
						width: THUMBNAIL_WIDTH,
						height: Math.round(THUMBNAIL_WIDTH * (size.height / size.width)),
					});
					setThumbnail(base64);
				}
			} catch (e) {
				// Bilden från "Välj område" finns kvar som reserv
				console.warn('Kunde inte ta bild av terrängen:', e);
			} finally {
				setCapturing(false);
			}
		}, TERRAIN_RENDER_DELAY_MS);
	}

	// Hamnar man här utan terräng (t.ex. efter en omladdning) börjar man om från steg 1
	if (!terrain) return <Redirect href="/create" />;

	const selectedIndex = controls.findIndex((c) => c.id === selectedId);
	const selected = selectedIndex >= 0 ? controls[selectedIndex] : null;

	// Området man valde i steg 1 – kontrollerna måste ligga inom det
	const area = terrain.bbox;

	/**
	 * Om en punkt ligger på (eller precis intill) en befintlig kontroll på skärmen.
	 * Kartans zoom avgör hur många meter en kontroll täcker, så avståndet räknas om från pixlar.
	 */
	function isOnExistingControl(point: Coordinate) {
		const size = mapSizeRef.current;
		if (!size) return false;
		const region = regionRef.current ?? bboxToRegion(area);
		const metersPerPixel = (region.latitudeDelta * METERS_PER_DEGREE_LAT) / size.height;
		const radiusM = CONTROL_TAP_RADIUS_PX * metersPerPixel;
		return controls.some((control) => distanceInMeters(control, point) <= radiusM);
	}

	function handleMapPress(e: MapPressEvent) {
		// På Android skickas även tryck på en markör till kartan – de ska inte skapa en ny kontroll
		if (e.nativeEvent.action === 'marker-press') return;
		// Bilden till kartlistan tas fortfarande
		if (capturing) return;
		// På iPhone når ett tryck på en kontroll även kartan, och då skulle en ny kontroll
		// hamna gömd under den man tryckte på. Det trycket hör till kontrollen, inte kartan.
		if (isOnExistingControl(e.nativeEvent.coordinate)) return;
		// Samma tryck kan komma fram två gånger – då ska det bara bli en kontroll
		if (Date.now() - lastAddedAtRef.current < DUPLICATE_PRESS_MS) return;

		if (selectedId) {
			setSelectedId(null); // ett tryck utanför stänger redigeringen
			return;
		}
		// Utanför området finns ingen terräng, så där går det inte att lägga kontroller
		if (!isInsideBbox(e.nativeEvent.coordinate, area)) {
			setTappedOutside(true);
			return;
		}
		setTappedOutside(false);
		lastAddedAtRef.current = Date.now();
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
			{/* collapsable={false}: på Android tas annars vyer utan eget utseende bort, och då finns inget att fotografera */}
			<View
				ref={mapContainerRef}
				style={StyleSheet.absoluteFill}
				collapsable={false}
				onLayout={(e) => (mapSizeRef.current = e.nativeEvent.layout)}
			>
				<MapView
					style={StyleSheet.absoluteFill}
					showsPointsOfInterests={false}
					initialRegion={bboxToRegion(terrain.bbox)}
					onRegionChangeComplete={(region) => (regionRef.current = region)}
					onPress={handleMapPress}
					// onMapReady, inte onMapLoaded – onMapLoaded finns bara för Google Maps på iOS
					onMapReady={handleMapReady}
					rotateEnabled={false}
					pitchEnabled={false}
					userInterfaceStyle="light"
				>
					<TerrainLayer terrain={terrain} />

					{/* Områdets kant, så man ser var kontrollerna får ligga. Ritas inte medan bilden till kartlistan tas. */}
					{!capturing && (
						<Polyline
							coordinates={[...bboxCorners(area), bboxCorners(area)[0]]}
							strokeColor={AREA_BORDER_COLOR}
							strokeWidth={4}
							lineDashPattern={[10, 6]}
						/>
					)}

					{/* Linje mellan kontrollerna i den ordning de ska tas */}
					{controls.length >= 2 && <Polyline coordinates={controls} strokeColor={COURSE_COLOR} strokeWidth={3} />}

					{controls.map((control, index) => (
						<Marker
							key={control.id}
							coordinate={control}
							draggable
							// Drar man kontrollen utanför området hamnar den vid kanten
							onDragEnd={(e) => moveControl(control.id, clampToBbox(e.nativeEvent.coordinate, area))}
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
			</View>

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
							area={area}
							onChange={(changes) => updateControl(selected.id, changes)}
							onDone={() => setSelectedId(null)}
							onRemove={handleRemove}
						/>
					) : capturing ? (
						<View style={styles.capturing}>
							<ActivityIndicator color={Colors.light.textMain} />
							<Text style={styles.hint}>Förbereder kartan…</Text>
						</View>
					) : (
						<>
							<Text style={styles.hint}>
								{controls.length === 0
									? 'Tryck på kartan för att placera första kontrollen'
									: 'Tryck på kartan för att lägga till, eller på en kontroll för att ändra den'}
							</Text>
							{tappedOutside && (
								<Text style={styles.warning}>Kontrollerna måste ligga inom det streckade området</Text>
							)}
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
	/** Området kontrollen måste ligga inom – koordinatfälten tar bara emot värden inom det */
	area: BoundingBox;
	onChange: (changes: Partial<Omit<Control, 'id'>>) => void;
	onDone: () => void;
	onRemove: () => void;
};

function ControlEditor({ control, number, isNew, area, onChange, onDone, onRemove }: ControlEditorProps) {
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
					min={area.south}
					max={area.north}
					onChange={(latitude) => onChange({ latitude })}
				/>
				<CoordinateInput
					label="Longitud"
					value={control.longitude}
					min={area.west}
					max={area.east}
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
	capturing: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 12,
	},
	hint: {
		fontSize: 16,
		textAlign: 'center',
		color: Colors.light.textMain,
	},
	warning: {
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
		color: Colors.light.danger,
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
