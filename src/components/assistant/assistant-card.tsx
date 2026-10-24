import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Body, Button, Card, Chip, Icon, Input, MicButton, Muted, Overline, Row, useModule } from '@/components/ui/kit';
import { askAssistant, type Respuesta } from '@/lib/assistant';
import { speak, stopSpeaking, useDictation } from '@/lib/voice';

const SUGERENCIAS = ['¿Cuánto gasté en comida?', '¿Qué pagos tengo esta semana?', '¿Qué rutina me toca hoy?', '¿Cuándo vence mi SOAT?'];

const ORIGEN: Record<Respuesta['modulo'], string> = {
  plata: 'Mi plata',
  coach: 'Coach',
  tareas: 'Tareas',
  cerebro: 'Segundo cerebro',
  ia: 'IA con el resumen de hoy',
};

// Un solo lugar para preguntarle a los 4 módulos, escribiendo o hablando.
export function AssistantCard() {
  const m = useModule('hoy');
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [pensando, setPensando] = useState(false);

  const { escuchando, parcial, empezar, parar } = useDictation((dicho) => {
    setPregunta(dicho);
    preguntar(dicho, true);
  });

  async function preguntar(texto = pregunta, conVoz = false) {
    if (!texto.trim()) return;
    setPensando(true);
    stopSpeaking();
    try {
      const r = await askAssistant(texto);
      setRespuesta(r);
      if (conVoz) speak(r.texto);
    } catch (e) {
      Alert.alert('No pude responder', e instanceof Error ? e.message : String(e));
    } finally {
      setPensando(false);
    }
  }

  return (
    <Card title="Pregúntame lo que sea" subtitle="Plata, documentos, gym y tareas" icon="creation" accent={m.solid}>
      <Row>
        <View style={{ flex: 1 }}>
          <Input
            icon="chat-question-outline"
            accent={m.solid}
            value={escuchando ? parcial : pregunta}
            onChangeText={setPregunta}
            onSubmitEditing={() => preguntar()}
            placeholder={escuchando ? 'Te escucho…' : '¿Cuánto me queda este mes?'}
            returnKeyType="send"
          />
        </View>
        <MicButton escuchando={escuchando} color={m.solid} onPress={escuchando ? parar : empezar} />
      </Row>
      {!respuesta ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {SUGERENCIAS.map((s) => (
            <Chip
              key={s}
              label={s}
              selected={false}
              color={m.solid}
              onPress={() => {
                setPregunta(s);
                preguntar(s);
              }}
            />
          ))}
        </Row>
      ) : null}
      <Button label="Preguntar" icon="send" color={m.solid} loading={pensando} onPress={() => preguntar()} />
      {respuesta ? (
        <Card variant="tinted" accent={m.solid}>
          <Row gap={6}>
            <Icon name="creation" size={16} color={m.solid} />
            <Overline color={m.solid}>{ORIGEN[respuesta.modulo]}</Overline>
          </Row>
          <Body>{respuesta.texto}</Body>
          <Row>
            <Button label="Escuchar" icon="volume-high" variant="secondary" size="sm" onPress={() => speak(respuesta.texto)} />
            <Button label="Nueva pregunta" icon="refresh" variant="ghost" size="sm" color={m.solid} onPress={() => setRespuesta(null)} />
          </Row>
          {respuesta.source === 'reglas' ? <Muted size={12}>Respondido al instante con tus datos guardados</Muted> : null}
        </Card>
      ) : null}
    </Card>
  );
}
