import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import the Firebase configuration
// ВНИМАНИЕ: При экспорте на GitHub этот файл конфигурации будет использовать проект из AI Studio.
// Для собственного продакшена замените содержимое файла firebase-applet-config.json на вашу конфигурацию Firebase,
// или вставьте объект конфигурации напрямую сюда.
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
