INSERT INTO "TaxType" (id, "businessId", name, description, "updatedAt")
VALUES ('dummy-tax-type-id', 'e24ee048-2039-4c2e-a1c9-24bf7b2f943e', 'Dummy Type', 'Dummy', '2020-01-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "TaxRate" (id, "taxTypeId", name, rate, "effectiveFrom") 
VALUES ('910c942c-e198-4897-bf85-e0908f635156', 'dummy-tax-type-id', 'Dummy Rate', 5, '2020-01-01') 
ON CONFLICT (id) DO NOTHING;
