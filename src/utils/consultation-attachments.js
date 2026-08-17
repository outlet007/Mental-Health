const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
const ATTACHMENT_DIR = path.join(__dirname, '../../data/consultation-attachments')
const ENCRYPTED_MAGIC = Buffer.from('MCA1')
const ALLOWED_DOCUMENTS = {
  '.pdf': { mimeTypes: ['application/pdf'], contentType: 'application/pdf' },
  '.doc': { mimeTypes: ['application/msword'], contentType: 'application/msword' },
  '.docx': {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
}

function getEncryptionKey() {
  const keyHex = process.env.DATA_ENCRYPTION_KEY || ''
  return /^[0-9a-f]{64}$/i.test(keyHex) ? Buffer.from(keyHex, 'hex') : null
}

function documentType(file) {
  const extension = path.extname(file?.originalname || '').toLowerCase()
  const definition = ALLOWED_DOCUMENTS[extension]
  if (!definition || !definition.mimeTypes.includes(file?.mimetype)) return null
  return { extension, ...definition }
}

function hasExpectedSignature(extension, buffer) {
  if (!Buffer.isBuffer(buffer)) return false
  if (extension === '.pdf') return buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))
  if (extension === '.doc') return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  if (extension === '.docx') return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  return false
}

function isAllowedDocument(file, { verifySignature = false } = {}) {
  const type = documentType(file)
  return Boolean(type && (!verifySignature || hasExpectedSignature(type.extension, file.buffer)))
}

function safeOriginalName(name) {
  return path.basename(String(name || 'document'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 180) || 'document'
}

function encryptBuffer(buffer, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  return Buffer.concat([ENCRYPTED_MAGIC, iv, cipher.getAuthTag(), encrypted])
}

function decryptBuffer(buffer, key) {
  if (!key) throw new Error('DATA_ENCRYPTION_KEY is required to read this attachment')
  const iv = buffer.subarray(4, 16)
  const tag = buffer.subarray(16, 32)
  const encrypted = buffer.subarray(32)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

function attachmentPath(storedName, directory = ATTACHMENT_DIR) {
  if (!storedName || path.basename(storedName) !== storedName) throw new Error('Invalid attachment path')
  return path.join(directory, storedName)
}

function saveConsultationAttachment(file, directory = ATTACHMENT_DIR) {
  const type = documentType(file)
  if (!type || !hasExpectedSignature(type.extension, file.buffer)) {
    const error = new Error('Unsupported or invalid document')
    error.code = 'INVALID_DOCUMENT'
    throw error
  }

  fs.mkdirSync(directory, { recursive: true })
  const key = getEncryptionKey()
  const storedName = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}.bin`
  const target = attachmentPath(storedName, directory)
  const temporary = `${target}.${process.pid}.tmp`
  fs.writeFileSync(temporary, key ? encryptBuffer(file.buffer, key) : file.buffer)
  fs.renameSync(temporary, target)

  return {
    storedName,
    originalName: safeOriginalName(file.originalname),
    contentType: type.contentType,
    size: file.size,
    encrypted: Boolean(key),
    uploadedAt: new Date().toISOString(),
  }
}

function readConsultationAttachment(metadata, directory = ATTACHMENT_DIR) {
  const contents = fs.readFileSync(attachmentPath(metadata.storedName, directory))
  if (!metadata.encrypted) return contents
  if (!contents.subarray(0, 4).equals(ENCRYPTED_MAGIC)) throw new Error('Encrypted attachment header is invalid')
  return decryptBuffer(contents, getEncryptionKey())
}

function deleteConsultationAttachment(metadata, directory = ATTACHMENT_DIR) {
  if (!metadata?.storedName) return
  try {
    fs.unlinkSync(attachmentPath(metadata.storedName, directory))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

module.exports = {
  ATTACHMENT_DIR,
  MAX_ATTACHMENT_SIZE,
  deleteConsultationAttachment,
  isAllowedDocument,
  readConsultationAttachment,
  saveConsultationAttachment,
}
