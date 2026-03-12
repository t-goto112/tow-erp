-- ─── profiles テーブルとトリガーの再作成 ───
-- 万が一 profiles テーブルがない、あるいは trigger が動かない場合、これを SQL Editor で実行してください。

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 自動 insert 用の関数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name','未設定'), 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーの再作成（既に存在すればエラーになる可能性を考慮し、一旦削除してから作成）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 既存の auth.users がいて profiles にない場合、一括で補完する
INSERT INTO public.profiles (id, full_name, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', '既設ユーザー'), 'admin'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- RLS設定
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read" ON profiles;
CREATE POLICY "Authenticated read" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
