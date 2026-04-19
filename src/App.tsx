/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Specchio dell'Anima - Ispirato da Stefano Rossi
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Mic, MicOff, RotateCcw, Heart, Lightbulb, Save, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Message {
  role: 'user' | 'model' | 'error';
  it: string;
  nl: string;
  insight?: string;
}

const SYSTEM_PROMPT = `Sei lo "Specchio dell'Anima", un mentore empatico ispirato alla psicologia di Stefano Rossi.
