import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 30;
const KNOB_SIZE = 26;
const KNOB_MARGIN = (TRACK_HEIGHT - KNOB_SIZE) / 2;

type Props = {
	isPrivate: boolean;
	onChange: (isPrivate: boolean) => void;
};

/**
 * Raden "Privat karta" med en toggle: på = privat (bara jag), av = publik (alla).
 * Egen toggle i stället för React Natives Switch, så den ser likadan ut överallt.
 */
export function PrivacyToggle({ isPrivate, onChange }: Props) {
	return (
		<Pressable
			style={styles.row}
			onPress={() => onChange(!isPrivate)}
			accessibilityRole="switch"
			accessibilityState={{ checked: isPrivate }}
			accessibilityLabel="Privat karta"
		>
			<Feather name={isPrivate ? 'lock' : 'globe'} size={18} color={Colors.light.textMain} />
			<View style={styles.textWrapper}>
				<Text style={styles.title}>Privat karta</Text>
				<Text style={styles.hint}>{isPrivate ? 'Bara du kan se kartan' : 'Alla kan se kartan'}</Text>
			</View>

			<View style={[styles.track, isPrivate && styles.trackOn]}>
				<View style={[styles.knob, isPrivate && styles.knobOn]} />
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	textWrapper: {
		flex: 1,
	},
	title: {
		fontSize: 15,
		fontWeight: '600',
		color: Colors.light.textMain,
	},
	hint: {
		fontSize: 13,
		color: Colors.light.textMuted,
		marginTop: 2,
	},
	track: {
		width: TRACK_WIDTH,
		height: TRACK_HEIGHT,
		borderRadius: TRACK_HEIGHT / 2,
		backgroundColor: Colors.light.border,
		justifyContent: 'center',
	},
	trackOn: {
		backgroundColor: Colors.light.primary,
	},
	knob: {
		width: KNOB_SIZE,
		height: KNOB_SIZE,
		borderRadius: KNOB_SIZE / 2,
		marginLeft: KNOB_MARGIN,
		backgroundColor: 'white',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 2,
		elevation: 2,
	},
	knobOn: {
		marginLeft: TRACK_WIDTH - KNOB_SIZE - KNOB_MARGIN,
	},
});
