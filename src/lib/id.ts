import { customAlphabet } from 'nanoid'

const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'
const generate = customAlphabet(alphabet, 10)

export function newPublicId(): string {
  return generate()
}
