import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { getForecasts, coordinateKey } from './weather.js';
import type { Coordinates } from './geocoding.js';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    isAxiosError: (error: unknown): boolean =>
      Boolean(error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError),
  },
}));

const mockedGet = vi.mocked(axios.get);

function realDaily() {
  return {
    time: ['2026-09-20', '2026-09-21'],
    weather_code: [0, 61],
    precipitation_probability_max: [10, 80],
    precipitation_sum: [0, 5],
    wind_speed_10m_max: [15, 20],
  };
}

function allNullDaily() {
  return {
    time: ['2026-09-20', '2026-09-21'],
    weather_code: [null, null],
    precipitation_probability_max: [null, null],
    precipitation_sum: [null, null],
    wind_speed_10m_max: [null, null],
  };
}

function rateLimitError(retryAfter?: string) {
  return {
    isAxiosError: true,
    response: { status: 429, headers: retryAfter ? { 'retry-after': retryAfter } : {} },
  };
}

// Each test uses coordinates no other test touches, so the module-level 30-minute cache in weather.ts
// can never leak a result between tests — no need to reset modules between them.
beforeEach(() => {
  mockedGet.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getForecasts', () => {
  it('fetches multiple coordinates in a single batched request', async () => {
    const coordA: Coordinates = { latitude: -10.1111, longitude: 110.1111 };
    const coordB: Coordinates = { latitude: -20.2222, longitude: 120.2222 };

    mockedGet.mockResolvedValueOnce({
      data: [{ daily: realDaily() }, { daily: realDaily() }],
    } as never);

    const result = await getForecasts([coordA, coordB]);

    expect(mockedGet).toHaveBeenCalledTimes(1);
    const [, config] = mockedGet.mock.calls[0]!;
    expect(config).toMatchObject({
      params: expect.objectContaining({
        latitude: '-10.1111,-20.2222',
        longitude: '110.1111,120.2222',
        models: 'bom_access_global',
      }),
    });

    expect(result.get(coordinateKey(coordA))?.[0]).toMatchObject({
      date: '2026-09-20',
      weatherCode: 0,
      source: 'bom_access_global',
    });
    expect(result.get(coordinateKey(coordB))?.[1]).toMatchObject({
      date: '2026-09-21',
      weatherCode: 61,
      source: 'bom_access_global',
    });
  });

  it('falls back to best_match only for the locations where bom_access_global is all-null', async () => {
    const coordA: Coordinates = { latitude: -11.3333, longitude: 111.3333 };
    const coordB: Coordinates = { latitude: -21.4444, longitude: 121.4444 };

    mockedGet
      .mockResolvedValueOnce({ data: [{ daily: realDaily() }, { daily: allNullDaily() }] } as never)
      // Fallback batch has only one location, so it comes back as a single object, not an array.
      .mockResolvedValueOnce({ data: { daily: realDaily() } } as never);

    const result = await getForecasts([coordA, coordB]);

    expect(mockedGet).toHaveBeenCalledTimes(2);

    const [, firstConfig] = mockedGet.mock.calls[0]!;
    expect(firstConfig).toMatchObject({
      params: expect.objectContaining({ models: 'bom_access_global', latitude: '-11.3333,-21.4444' }),
    });

    const [, secondConfig] = mockedGet.mock.calls[1]!;
    expect(secondConfig?.params.models).toBeUndefined();
    expect(secondConfig?.params.latitude).toBe('-21.4444');

    expect(result.get(coordinateKey(coordA))?.[0].source).toBe('bom_access_global');
    expect(result.get(coordinateKey(coordB))?.[0].source).toBe('best_match');
  });

  it('reuses an already-cached coordinate instead of refetching it', async () => {
    const coordC: Coordinates = { latitude: -12.5555, longitude: 112.5555 };
    const coordD: Coordinates = { latitude: -22.6666, longitude: 122.6666 };

    mockedGet.mockResolvedValueOnce({ data: [{ daily: realDaily() }] } as never);
    await getForecasts([coordC]);
    expect(mockedGet).toHaveBeenCalledTimes(1);

    mockedGet.mockResolvedValueOnce({ data: [{ daily: realDaily() }] } as never);
    const result = await getForecasts([coordC, coordD]);

    expect(mockedGet).toHaveBeenCalledTimes(2);
    const [, secondConfig] = mockedGet.mock.calls[1]!;
    expect(secondConfig?.params.latitude).toBe('-22.6666');

    expect(result.has(coordinateKey(coordC))).toBe(true);
    expect(result.has(coordinateKey(coordD))).toBe(true);
  });

  it('retries on 429 and succeeds once Open-Meteo stops throttling', async () => {
    vi.useFakeTimers();
    const coordE: Coordinates = { latitude: -13.7777, longitude: 113.7777 };

    mockedGet
      .mockRejectedValueOnce(rateLimitError())
      .mockRejectedValueOnce(rateLimitError('1'))
      .mockResolvedValueOnce({ data: [{ daily: realDaily() }] } as never);

    const promise = getForecasts([coordE]);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(mockedGet).toHaveBeenCalledTimes(3);
    expect(result.get(coordinateKey(coordE))?.[0].source).toBe('bom_access_global');
  });

  it('gives up after exhausting retries and omits the location rather than failing the whole batch', async () => {
    vi.useFakeTimers();
    const coordF: Coordinates = { latitude: -14.8888, longitude: 114.8888 };
    const coordG: Coordinates = { latitude: -24.9999, longitude: 124.9999 };

    mockedGet.mockRejectedValue(rateLimitError());

    const promise = getForecasts([coordF, coordG]);
    await vi.runAllTimersAsync();
    const result = await promise;

    // Both coordinates share the one batched request, so both attempts (and all their retries) are the
    // same calls — 3 total, not 3 per coordinate.
    expect(mockedGet).toHaveBeenCalledTimes(3);
    expect(result.has(coordinateKey(coordF))).toBe(false);
    expect(result.has(coordinateKey(coordG))).toBe(false);
  });
});
