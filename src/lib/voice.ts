import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { PALABRAS_DICTADO, fixDictation } from '@/lib/voice-text';

const IDIOMA = 'es-PE';

// Dictado por voz. Cada pantalla tiene su micrófono, pero como las pestañas siguen montadas,
// solo proceso los eventos del micrófono que yo mismo encendí.
export function useDictation(onFinal: (texto: string) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState('');
  const activo = useRef(false);
  // Un solo resultado final por sesión: algunos celulares mandan el final dos veces.
  const entregado = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    if (activo.current) setEscuchando(true);
  });
  useSpeechRecognitionEvent('end', () => {
    if (!activo.current) return;
    activo.current = false;
    setEscuchando(false);
  });
  useSpeechRecognitionEvent('result', (e) => {
    if (!activo.current) return;
    const texto = fixDictation(e.results[0]?.transcript ?? '');
    setParcial(texto);
    if (e.isFinal && texto && !entregado.current) {
      entregado.current = true;
      onFinal(texto);
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (!activo.current) return;
    activo.current = false;
    setEscuchando(false);
    // "no-speech" y "aborted" son normales (me quedé callado o lo cancelé).
    if (e.error !== 'no-speech' && e.error !== 'aborted') Alert.alert('No pude escucharte', e.message);
  });

  const empezar = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Micrófono', 'Necesito permiso del micrófono para escucharte.');
      return;
    }
    Speech.stop();
    setParcial('');
    activo.current = true;
    entregado.current = false;
    ExpoSpeechRecognitionModule.start({
      lang: IDIOMA,
      interimResults: true,
      addsPunctuation: true,
      maxAlternatives: 1,
      // Pistas para que entienda "SOAT", "brevete" o "Rímac" a la primera (Android 13+).
      contextualStrings: PALABRAS_DICTADO,
      // Corto antes cuando dejo de hablar: la respuesta llega más rápido.
      androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500 },
    });
  }, []);

  const parar = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { escuchando, parcial, empezar, parar };
}

// Leo la respuesta en voz alta, sin las marcas de fuente como [1].
export function speak(texto: string) {
  const limpio = texto
    .replace(/\[\d+\]/g, '')
    .replace(/Fuente:.*$/gim, '')
    .replace(/S\/\s?/g, 'soles ')
    .trim();
  Speech.stop();
  Speech.speak(limpio, { language: IDIOMA, rate: 1.0 });
}

export function stopSpeaking() {
  Speech.stop();
}
