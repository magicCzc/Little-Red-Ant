import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import { WebSocket } from 'ws'
import crypto from 'crypto';

const baseUrl = `speech.platform.bing.com/consumer/speech/synthesize/readaloud`
const token = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const webSocketURL = `wss://${baseUrl}/edge/v1?TrustedClientToken=${token}`

function uuid() {
  return crypto.randomUUID().replace(/-/g, '')
}

export type TtsOptions = Partial<{
  voice: string,
  volume: string,
  rate: string,
  pitch: string
}>

export function tts(text: string, options: TtsOptions = {}): Promise<Buffer> {
  const { voice = 'zh-CN-XiaoxiaoNeural', volume = '+0%', rate = '+0%', pitch = '+0Hz' } = options

  return new Promise<Buffer>((resolve, reject) => {
    const ws = new WebSocket(`${webSocketURL}&ConnectionId=${uuid()}`, {
      host: 'speech.platform.bing.com',
      origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.66 Safari/537.36 Edg/103.0.1264.44' },
    })
    const audioData: Buffer[] = []
    
    ws.on('message', (rawData, isBinary) => {
      if (!isBinary) {
        const data = rawData.toString('utf8')
        if (data.includes('turn.end')) {
          resolve(Buffer.concat(audioData))
          ws.close()
        }
        return
      }
      const data = rawData as Buffer
      const separator = 'Path:audio\r\n'
      const idx = data.indexOf(separator)
      if (idx >= 0) {
          const content = data.subarray(idx + separator.length)
          audioData.push(content)
      }
    })
    
    ws.on('error', (e) => {
        console.error('EdgeTTS WebSocket Error:', e);
        reject(e);
    })

    const speechConfig = JSON.stringify({ context: { synthesis: { audio: {
      metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    } } } })
    
    const configMessage = `X-Timestamp:${Date()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${speechConfig}`
    
    ws.on('open', () => {
        ws.send(configMessage, { compress: true }, (configError) => {
            if (configError) return reject(configError)

            const ssmlMessage = `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\n`
                + `X-Timestamp:${Date()}Z\r\nPath:ssml\r\n\r\n`
                + `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>`
                + `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>`
                + `${text}</prosody></voice></speak>`
            
            ws.send(ssmlMessage, { compress: true }, (ssmlError) => {
                if (ssmlError) reject(ssmlError)
            })
        })
    })
  })
}

export async function ttsSave(text: string, file: string, options: TtsOptions = {}) {
  const buffer = await tts(text, options)
  fs.writeFileSync(file, buffer)
}
