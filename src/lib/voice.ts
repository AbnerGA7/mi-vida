import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

const IDIOMA = 'es-PE';

// Dictado por voz. Cada pantalla tiene su micrófono, pero como las pestañas siguen montadas,
// solo proceso los eventos del micrófono que yo mismo encendí.
export function useDictation(onFinal: (texto: string) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState('');
  const activo = useRef(false);

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
    const texto = e.results[0]?.transcript ?? '';
    setParcial(texto);
    if (e.isFinal && texto.trim()) onFinal(texto.trim());
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
    ExpoSpeechRecognitionModule.start({ lang: IDIOMA, interimResults: true, addsPunctuation: true });
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
