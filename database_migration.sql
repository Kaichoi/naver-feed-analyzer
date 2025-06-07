-- Supabase 데이터베이스 마이그레이션 스크립트
-- is_admin 컬럼 추가

-- 1. profiles 테이블에 is_admin 컬럼 추가
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. 기존 사용자들에게 기본값 설정
UPDATE public.profiles 
SET is_admin = FALSE 
WHERE is_admin IS NULL;

-- 3. is_admin 컬럼에 NOT NULL 제약 조건 추가
ALTER TABLE public.profiles 
ALTER COLUMN is_admin SET NOT NULL;

-- 4. 특정 사용자를 관리자로 설정 (이메일 주소 변경 필요)
-- UPDATE public.profiles 
-- SET is_admin = TRUE 
-- WHERE email = 'your-admin-email@example.com';

-- 5. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- 6. RLS 정책 업데이트 (필요시)
-- 관리자만 다른 사용자의 is_admin 필드를 수정할 수 있도록 설정
-- CREATE POLICY "Only admins can update admin status" ON public.profiles
-- FOR UPDATE USING (auth.uid() = id OR 
--   (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = TRUE);

COMMENT ON COLUMN public.profiles.is_admin IS '관리자 권한 여부'; 