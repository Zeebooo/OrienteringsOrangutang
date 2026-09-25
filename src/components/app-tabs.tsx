import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function AppTabs() {
	return (
		<Tabs
			screenOptions={{
				tabBarShowLabel: false,

				tabBarStyle: {
					backgroundColor: '#d4d4d4',
					borderTopWidth: 0,
					height: 70,
					elevation: 0,
					shadowOpacity: 0,
				},

				tabBarItemStyle: {
					justifyContent: 'center',
					alignItems: 'center',
				},

				tabBarActiveTintColor: '#000',
				tabBarInactiveTintColor: '#727272',
			}}
		>
			{/* Kartan */}
			<Tabs.Screen
				name="index"
				options={{
					headerShown: false,
					tabBarIcon: ({ color }) => (
						<Feather name="map" size={28} color={color} />
					),
				}}
			/>

			{/* Profilen */}
			<Tabs.Screen
				name="profile"
				options={{
					headerShown: false,
					tabBarIcon: ({ color }) => (
						<Feather name="user" size={28} color={color} />
					),
				}}
			/>

			{/* Kartan */}
			<Tabs.Screen
				name="map"
				options={{
					headerShown: false,
					tabBarIcon: ({ color }) => (
						<Feather name="map" size={28} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}