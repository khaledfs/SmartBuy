// MainScreen.js (updated to match UI from second image)
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Button,
    StyleSheet,
    FlatList,
    TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'http://10.0.2.2:3000/api/lists';

export default function MainScreen({ navigation }) {
    const [lists, setLists] = useState([]);

    const fetchLists = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setLists(res.data);
        } catch (err) {
            console.error('Fetch lists error:', err);
        }
    };

    useEffect(() => {
        const checkSession = async () => {
            const token = await AsyncStorage.getItem('token');
            if (!token) navigation.replace('Login');
            else fetchLists();
        };
        checkSession();
    }, []);

    const logout = async () => {
        await AsyncStorage.removeItem('token');
        navigation.replace('Login');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Main Screen</Text>

            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('ShoppingList')}>
                    <Text style={styles.buttonText}>CREATE LIST</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.button}>
                    <Text style={styles.buttonText}>EDIT LIST</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>Existing Lists</Text>
            <FlatList
                data={lists}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <Text style={styles.item}>- {item.name}</Text>
                )}
            />

            <Text style={styles.subtitle}>Previous Shoppings</Text>
            <FlatList
                data={[{ id: '3', name: 'Last Week' }, { id: '4', name: '2 Weeks Ago' }]}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <Text style={styles.item}>- {item.name}</Text>}
            />

            <View style={{ marginTop: 20 }}>
                <Button title="LOGOUT" color="red" onPress={logout} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    subtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
    item: { fontSize: 16, marginBottom: 4 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
    button: {
        backgroundColor: '#2196F3',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    buttonText: { color: '#fff', fontWeight: 'bold' },
});
