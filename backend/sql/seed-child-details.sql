-- Seed missing child details (weight, length, blood type) for the 3 demo children
-- Run this in Supabase SQL Editor

-- Update Esi Boadu (born 2023-05-10)
UPDATE children
SET 
  birth_weight = 12.5,      -- 12.5 kg (healthy weight for 2.5 year old)
  birth_length = 88,        -- 88 cm (healthy height for 2.5 year old)
  blood_type = 'O+'
WHERE cvcc_id = 'CHILD-001'
   OR id = 'c1000000-0000-0000-0000-000000000100';

-- Update Kojo Asante (born 2024-03-22) 
UPDATE children
SET 
  birth_weight = 10.2,      -- 10.2 kg (healthy weight for ~21 month old)
  birth_length = 82,        -- 82 cm (healthy height for ~21 month old)
  blood_type = 'A+'
WHERE cvcc_id = 'CHILD-002'
   OR id = 'c1000000-0000-0000-0000-000000000101';

-- Update Zara Asante (born 2022-01-05)
UPDATE children
SET 
  birth_weight = 16.0,      -- 16 kg (healthy weight for 4 year old)
  birth_length = 102,       -- 102 cm (healthy height for 4 year old)
  blood_type = 'B+'
WHERE cvcc_id = 'CHILD-003'
   OR id = 'c1000000-0000-0000-0000-000000000102';

-- Verify the updates
SELECT 
  cvcc_id,
  id,
  full_name as name,
  date_of_birth,
  birth_weight,
  birth_length,
  blood_type,
  gender
FROM children
WHERE cvcc_id IN ('CHILD-001', 'CHILD-002', 'CHILD-003')
ORDER BY cvcc_id;
