# Lexora - Base de Datos Supabase

Este directorio contiene todas las migraciones, scripts y documentación para la base de datos de Lexora.

## 📁 Estructura

```
supabase/
├── database_schema.sql                     # 📋 Schema completo de la base de datos
├── rls_policies.sql                        # 🔐 Políticas RLS optimizadas
├── migrations/
│   ├── 00001_new_normalized_schema.sql    # (Legacy) Schema original
│   ├── 00002_rls_policies.sql             # (Legacy) Políticas originales
│   └── 00003_add_delete_policies.sql      # (Legacy) Políticas DELETE
├── verify_migration.sql                    # ✅ Script de verificación
├── maintenance_queries.sql                 # 🔧 Queries útiles
└── README.md                               # Este archivo
```

## 🚀 Quick Start

### Instalación Limpia (Recomendado)

```bash
# Con Supabase CLI
supabase db reset

# O ejecutar los archivos consolidados
psql -U postgres -d lexora -f supabase/database_schema.sql
psql -U postgres -d lexora -f supabase/rls_policies.sql
```

### Verificar Instalación

```bash
psql -U postgres -d lexora -f supabase/verify_migration.sql
```

Deberías ver:
```
✓ Tablas creadas: 18
✓ Tablas con RLS: 18
✓ Políticas RLS: 50+
✓ Planes de suscripción: 3
✓✓✓ VERIFICACIÓN EXITOSA ✓✓✓
```

### 3. Configurar Trigger de Autenticación

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user_v2();
```

## 📚 Documentación Detallada

### Para Desarrolladores
- **[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)** - Guía completa de instalación y configuración
- **[MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)** - Resumen de todos los cambios realizados

### Para Features Específicos
- **[VIDEO_MEDIA_SUPPORT.md](VIDEO_MEDIA_SUPPORT.md)** - Documentación completa sobre soporte de videos en RSS

### Para Mantenimiento
- **[verify_migration.sql](verify_migration.sql)** - Script para verificar la instalación
- **[maintenance_queries.sql](maintenance_queries.sql)** - Colección de queries útiles

## 🎯 Características Principales

### Schema Normalizado
- 18 tablas optimizadas para escala
- Relaciones Many-to-Many eficientes
- Soporte multi-plataforma (RSS, YouTube, Twitter, etc.)

### Soporte de Videos en RSS ✨ NUEVO
```sql
-- Tabla rss_content incluye:
featured_media_type      -- 'none', 'image', 'video'
featured_media_url       -- URL del video o imagen
featured_thumbnail_url   -- Thumbnail para videos
featured_media_duration  -- Duración en segundos
```

### Seguridad (RLS)
- Row Level Security en todas las tablas
- Políticas granulares por usuario
- Protección contra eliminación accidental
- Limpieza automática de datos antiguos

### Optimización
- Índices en columnas clave
- Triggers automáticos
- Funciones de mantenimiento

## 🗂️ Tablas Principales

### Usuarios y Configuración
- `profiles` - Perfiles de usuario
- `user_subscriptions` - Suscripciones a planes
- `user_viewer_settings` - Configuración del lector
- `user_interface_settings` - Configuración de UI
- `user_notification_settings` - Configuración de notificaciones
- `user_privacy_settings` - Configuración de privacidad

### Fuentes y Contenido
- `content_sources` - Fuentes compartidas (RSS, YouTube, etc.)
- `user_sources` - Relación usuario-fuente
- `rss_content` - Artículos RSS (con videos)
- `youtube_content` - Videos de YouTube
- `twitter_content` - Tweets
- `instagram_content` - Posts de Instagram
- `tiktok_content` - Videos de TikTok
- `podcast_content` - Episodios de podcasts

### Relaciones
- `user_content` - Estado del usuario con contenido (leído, favorito, etc.)
- `collections_new` - Colecciones de contenido
- `collection_items` - Items en colecciones

## 🔧 Comandos Útiles

### Verificar Estado
```bash
# Ver estadísticas generales
psql -U postgres -d lexora -c "
SELECT 
  'Usuarios' as tipo, COUNT(*) as total FROM profiles
  UNION ALL
  SELECT 'Fuentes', COUNT(*) FROM content_sources
  UNION ALL
  SELECT 'Artículos RSS', COUNT(*) FROM rss_content;
"
```

### Ejecutar Limpieza
```sql
SELECT cleanup_old_unarchived_content();
```

### Ver Videos en RSS
```sql
SELECT 
  featured_media_type,
  COUNT(*) as count
FROM rss_content
GROUP BY featured_media_type;
```

### Backup de Usuario
```bash
# Exportar datos de un usuario
pg_dump -U postgres -d lexora -t profiles -t user_sources --data-only > user_backup.sql
```

## 🐛 Troubleshooting

### Problema: Error "relation already exists"
**Solución:**
```bash
supabase db reset  # Resetear todo
# O eliminar tablas manualmente y volver a ejecutar
```

### Problema: Videos no se muestran
**Verificar:**
1. `featured_media_url` tiene valor
2. `featured_media_type` es 'video'
3. CORS permite el acceso al video
4. Tipo MIME es soportado por el navegador

### Problema: Usuario sin configuraciones
**Reparar:**
```sql
DO $$
DECLARE
  target_user_id uuid := 'UUID_DEL_USUARIO';
BEGIN
  INSERT INTO user_viewer_settings (user_id) VALUES (target_user_id) ON CONFLICT DO NOTHING;
  INSERT INTO user_interface_settings (user_id) VALUES (target_user_id) ON CONFLICT DO NOTHING;
  INSERT INTO user_notification_settings (user_id) VALUES (target_user_id) ON CONFLICT DO NOTHING;
  INSERT INTO user_privacy_settings (user_id) VALUES (target_user_id) ON CONFLICT DO NOTHING;
END $$;
```

## 📊 Monitoreo

### Tamaño de Base de Datos
```sql
SELECT 
  pg_size_pretty(pg_database_size('lexora')) as database_size;
```

### Tablas más Grandes
```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC
LIMIT 10;
```

## 🔐 Seguridad

### Políticas RLS Configuradas
- ✅ Usuarios solo ven su propio contenido
- ✅ Contenido compartido mediante relaciones
- ✅ Planes de suscripción visibles para todos
- ✅ Protección contra eliminación de contenido archivado

### Auditoría
```sql
-- Ver accesos recientes (requiere configuración adicional)
SELECT * FROM pg_stat_activity 
WHERE datname = 'lexora' 
ORDER BY query_start DESC 
LIMIT 20;
```

## 📈 Rendimiento

### Índices Creados
- Índices en `source_id`, `user_id`, `published_at`
- Índices compuestos para queries comunes
- Índices parciales para filtros frecuentes

### Consultas Optimizadas
- Uso de CTEs para queries complejas
- Joins eficientes con índices
- Límites en queries de feed

## 🚀 Próximos Pasos

1. ✅ Ejecutar migraciones
2. ✅ Verificar instalación
3. ✅ Configurar trigger de auth
4. ✅ Probar con feeds RSS
5. ✅ Agregar fuentes con videos
6. ⏳ Monitorear rendimiento
7. ⏳ Ajustar índices según uso real

## 📞 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

**Última actualización:** 21 de noviembre de 2025  
**Versión del Schema:** 2.0  
**Estado:** ✅ Listo para producción
