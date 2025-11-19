-- =============================================
-- SEEDS: Datos de ejemplo para desarrollo
-- =============================================
-- NOTA: Ejecuta esto DESPUÉS de crear un usuario de prueba

-- Función helper para obtener el ID del primer usuario (para testing)
do $$
declare
  test_user_id uuid;
begin
  -- Obtener el primer usuario
  select id into test_user_id from auth.users limit 1;
  
  if test_user_id is not null then
    -- Insertar fuentes de ejemplo
    insert into public.sources (user_id, title, url, description, category, favicon_url) values
      (test_user_id, 'TechCrunch', 'https://techcrunch.com/feed/', 'Technology news and analysis', 'Technology', 'https://techcrunch.com/favicon.ico'),
      (test_user_id, 'The Verge', 'https://www.theverge.com/rss/index.xml', 'Technology, science, art, and culture', 'Technology', 'https://www.theverge.com/favicon.ico'),
      (test_user_id, 'Hacker News', 'https://hnrss.org/frontpage', 'Social news for hackers and tech enthusiasts', 'Technology', 'https://news.ycombinator.com/favicon.ico'),
      (test_user_id, 'CSS-Tricks', 'https://css-tricks.com/feed/', 'Web design and development', 'Development', 'https://css-tricks.com/favicon.ico'),
      (test_user_id, 'Smashing Magazine', 'https://www.smashingmagazine.com/feed/', 'For web designers and developers', 'Development', 'https://www.smashingmagazine.com/favicon.svg');
    
    raise notice 'Seeds insertados correctamente para el usuario %', test_user_id;
  else
    raise notice 'No se encontró ningún usuario. Crea un usuario primero.';
  end if;
end $$;
