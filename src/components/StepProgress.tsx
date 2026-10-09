import { Feather } from '@expo/vector-icons';
import { Fragment } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

const COLOR = Colors.light.accent;
const SIZE = 30;

type Props = {
	/** Aktuellt steg, 1-baserat */
	current: number;
	total: number;
	style?: StyleProp<ViewStyle>;
};

/**
 * Stegindikator: ✓ för klara steg, fylld cirkel för aktuellt steg, ofylld för kommande.
 *   (✓)───(2)───(3)
 */
export function StepProgress({ current, total, style }: Props) {
	const steps = Array.from({ length: total }, (_, i) => i + 1);

	return (
		<View style={[styles.row, style]}>
			{steps.map((step) => {
				const done = step < current;
				const active = step === current;

				return (
					<Fragment key={step}>
						{/* Linje före varje steg utom det första */}
						{step > 1 && <View style={[styles.line, step <= current && styles.lineDone]} />}

						<View style={[styles.circle, (done || active) && styles.circleFilled]}>
							{done ? (
								<Feather name="check" size={16} color="white" />
							) : (
								<Text style={[styles.number, active && styles.numberActive]}>{step}</Text>
							)}
						</View>
					</Fragment>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	circle: {
		width: SIZE,
		height: SIZE,
		borderRadius: SIZE / 2,
		borderWidth: 2,
		borderColor: COLOR,
		backgroundColor: 'white',
		justifyContent: 'center',
		alignItems: 'center',
	},
	circleFilled: {
		backgroundColor: COLOR,
	},
	number: {
		fontWeight: 'bold',
		color: COLOR,
	},
	numberActive: {
		color: 'white',
	},
	line: {
		flex: 1,
		height: 2,
		backgroundColor: COLOR,
		opacity: 0.4,
	},
	lineDone: {
		opacity: 1,
	},
});
