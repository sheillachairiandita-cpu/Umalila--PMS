-- Fix Kayuputih admin password (run in Supabase SQL Editor).
-- Password: Ellaemangokegitu1
-- Regenerate hash: cd backend; node --input-type=module -e "import('./lib/rbac/auth.js').then(m => console.log(m.hashPassword('YourPassword')))"

UPDATE public.users
SET password_hash = '971bcd6aad7f39aa78f7a80a7f296245:adab81acc45fd96ece9ffb926d032f36b8964dd3578a2358a83df6f049426b11bfbc2523eded1fcf2cf47b289e54baf6e1dc46cd9b03746ba27b31165409230c'
WHERE email = 'admin@kayuputih.com';
