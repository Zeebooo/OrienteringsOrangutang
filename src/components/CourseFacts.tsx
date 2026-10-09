import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { Colors } from '@/constants/theme';
import type { Difficulty } from '@/types';

const DISTANCE_ICON = require('@/assets/HiFi/path_distance_icon.png');
const CONTROL_ICON = require('@/assets/HiFi/controll_icon.png');

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
	easy: 'Lätt',
	medium: 'Medelsvår',
	hard: 'Svår',
};

export const formatKm = (meters: number) => (meters / 1000).toFixed(1).replace('.', ',');

/** En liten beige ruta med ikon och text, t.ex. "3,4 km". */
export function Fact({ icon, text }: { icon: ImageSourcePropType | ReactNode; text: string }) {
	return (
		<View style={styles.fact}>
			{isImageSource(icon) ? <Image source={icon} style={styles.factIcon} /> : icon}
			<Text style={styles.factText} numberOfLines={1}>
				{text}
			</Text>
		</View>
	);
}

export function DistanceFact({ meters }: { meters: number | null }) {
	return <Fact icon={DISTANCE_ICON} text={meters !== null ? `${formatKm(meters)} km` : '– km'} />;
}

export function ControlsFact({ count }: { count: number }) {
	return <Fact icon={CONTROL_ICON} text={`${count} kontroller`} />;
}

export function DifficultyFact({ difficulty }: { difficulty: Difficulty }) {
	return (
		<Fact
			icon={<Feather name="bar-chart-2" size={16} color={Colors.light.accent} />}
			text={DIFFICULTY_LABELS[difficulty]}
		/>
	);
}

type SummaryProps = {
	name: string;
	description: string;
	distanceM: number | null;
	controlsCount: number;
	difficulty: Difficulty;
};

/** Namn, beskrivning och banfakta – används på "Granska karta" och "Karta publicerad". */
export function MapSummary({ name, description, distanceM, controlsCount, difficulty }: SummaryProps) {
	return (
		<View>
			<Text style={styles.name}>{name}</Text>
			{description.length > 0 && <Text style={styles.description}>{description}</Text>}
			<View style={styles.row}>
				<DistanceFact meters={distanceM} />
				<ControlsFact count={controlsCount} />
				<DifficultyFact difficulty={difficulty} />
			</View>
		</View>
	);
}

// En bild från require() är ett tal (eller ett objekt med uri), en ikonkomponent är ett React-element
function isImageSource(icon: ImageSourcePropType | ReactNode): icon is ImageSourcePropType {
	return typeof icon === 'number' || (typeof icon === 'object' && icon !== null && 'uri' in icon);
}

const styles = StyleSheet.create({
	fact: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		backgroundColor: Colors.light.beigeBg,
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 6,
	},
	factIcon: {
		width: 18,
		height: 18,
		resizeMode: 'contain',
	},
	factText: {
		fontSize: 14,
		fontWeight: '600',
		color: Colors.light.text,
		flexShrink: 1,
	},
	name: {
		fontSize: 20,
		fontWeight: 'bold',
		color: Colors.light.text,
		marginLeft: 12,
	},
	description: {
		fontSize: 14,
		color: Colors.light.textMain,
		marginLeft: 12,
		marginTop: 2,
	},
	row: {
		flexDirection: 'row',
		gap: 8,
		marginTop: 18,
	},
});
