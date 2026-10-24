// Entrada de la app: defino las tareas en segundo plano antes que las pantallas,
// porque Android puede abrir la app sin interfaz solo para correrlas.
import './src/lib/background/brief-task';
import 'expo-router/entry';
