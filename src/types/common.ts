export type Id = number

export interface ApiError {
  message: string
  status?: number
  fieldErrors?: Record<string, string>
}
