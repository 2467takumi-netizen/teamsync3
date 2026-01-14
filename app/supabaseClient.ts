import { createClient } from '@supabase/supabase-js';

// 直接URLとキーを貼り付けます（'' で囲むのを忘れないでください）
const supabaseUrl = 'https://crffuqvdtdilsjetxglf.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyZmZ1cXZkdGRpbHNqZXR4Z2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0MzE5MDMsImV4cCI6MjA4MzAwNzkwM30.kOtgBktA0UD0cVbl4xOxtG6aItwiR-bzo_isxpznf5o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
