// Конфигурация Firebase (замените на свою конфигурацию)
const firebaseConfig = {
  apiKey: "AIzaSyDxUTWvjJkejojinWgLO-ILkVfOvXiILmY",
  authDomain: "test1-30fd5.firebaseapp.com",
  projectId: "test1-30fd5",
  storageBucket: "test1-30fd5.firebasestorage.app",
  messagingSenderId: "327844766977",
  appId: "1:327844766977:web:b7e84602f759c8c70ce700",
  measurementId: "G-S797EVV2NF"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();