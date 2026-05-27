/**
 * coopCode.ts — Geração de código Co-op compatível com React Native
 *
 * Não usa crypto — compatível com React Native sem polyfills.
 * Esta implementação usa uma combinação de Date.now() e Math.random()
 * com suficiente entropia para um código de conexão (não é criptografia,
 * é só um código de pareamento — segurança adequada para o caso de uso).
 *
 * Para criptografia real (senhas, tokens de auth), use expo-crypto.
 */

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sem 0/O, 1/l/I

/**
 * Gera código Co-op com entropia mista.
 * Exemplo: "NUT-X4KM-W7QP"
 * ~1 trilhão de combinações — suficiente para um código de pareamento.
 */
export function generateCoopCode(): string {
  const time    = Date.now().toString(36).toUpperCase()
  const rand1   = Math.random().toString(36).slice(2).toUpperCase()
  const rand2   = Math.random().toString(36).slice(2).toUpperCase()
  const entropy = (time + rand1 + rand2).replace(/[^A-Z0-9]/g, '')

  let code = ''
  for (let i = 0; i < 8; i++) {
    // Combina posição, caractere de entropia e Math.random para cada dígito
    const charCode  = entropy.charCodeAt(i % entropy.length) || 65
    const randExtra = Math.floor(Math.random() * CHARS.length)
    const idx       = (charCode + randExtra + i) % CHARS.length
    code += CHARS[idx]
  }

  return `NUT-${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * Valida formato do código antes de buscar no banco.
 * Evita queries desnecessárias com strings malformadas.
 */
export function isValidCoopCode(code: string): boolean {
  return /^NUT-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(
    code.toUpperCase().trim()
  )
}

/**
 * Normaliza o código (maiúsculo, sem espaços).
 */
export function normalizeCoopCode(input: string): string {
  return input.toUpperCase().trim().replace(/\s/g, '')
}
