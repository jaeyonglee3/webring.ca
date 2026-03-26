import { describe, it, expect } from 'vitest'
import { fisherYatesShuffle } from '../utils/shuffle'

describe('fisherYatesShuffle', () => {
  it('returns an array of the same length', () => {
    const input = [1, 2, 3, 4, 5]
    const result = fisherYatesShuffle(input)
    expect(result).toHaveLength(input.length)
  })

  it('contains all original elements', () => {
    const input = ['a', 'b', 'c', 'd', 'e']
    const result = fisherYatesShuffle(input)
    expect(result.sort()).toEqual([...input].sort())
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    fisherYatesShuffle(input)
    expect(input).toEqual(copy)
  })

  it('accepts readonly arrays', () => {
    const input: readonly string[] = ['x', 'y', 'z']
    const result = fisherYatesShuffle(input)
    expect(result.sort()).toEqual(['x', 'y', 'z'])
  })

  it('handles empty array', () => {
    expect(fisherYatesShuffle([])).toEqual([])
  })

  it('handles single-element array', () => {
    expect(fisherYatesShuffle([42])).toEqual([42])
  })
})
