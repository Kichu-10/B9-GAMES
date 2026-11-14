
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `b9game` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `b9game`;
DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `action` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `details` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `game_catalog_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_catalog_settings` (
  `id` tinyint unsigned NOT NULL,
  `page_size` int NOT NULL DEFAULT '24',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `game_catalog_settings` WRITE;
/*!40000 ALTER TABLE `game_catalog_settings` DISABLE KEYS */;
INSERT INTO `game_catalog_settings` VALUES (1,24);
/*!40000 ALTER TABLE `game_catalog_settings` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `game_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_categories` (
  `name` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE KEY `game_categories_sort_order_unique` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `game_categories` WRITE;
/*!40000 ALTER TABLE `game_categories` DISABLE KEYS */;
INSERT INTO `game_categories` VALUES ('Popular',0),('Mini Games',1),('Slots',2),('Fishing',3);
/*!40000 ALTER TABLE `game_categories` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `game_players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_players` (
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_created` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `game_players_player_id_unique` (`player_id`),
  CONSTRAINT `fk_game_players_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `game_players` WRITE;
/*!40000 ALTER TABLE `game_players` DISABLE KEYS */;
/*!40000 ALTER TABLE `game_players` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `game_providers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_providers` (
  `code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `logo` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `game_providers` WRITE;
/*!40000 ALTER TABLE `game_providers` DISABLE KEYS */;
INSERT INTO `game_providers` VALUES ('EZUGI','Ezugi',1,'','2026-11-09 14:47:25.000','2026-11-09 14:47:25.000'),('FACHAI','FaChai',1,'','2026-11-09 14:47:25.000','2026-11-09 14:47:25.000'),('INOUT','Inout',1,'','2026-11-09 14:47:24.000','2026-11-09 14:47:24.000'),('JDB','JDB',1,'','2026-11-09 14:47:24.000','2026-11-09 14:47:24.000'),('JL','JILI',1,'','2026-11-09 14:47:24.000','2026-11-09 14:47:24.000'),('PG','PGSoft',1,'','2026-11-09 14:47:24.000','2026-11-09 14:47:24.000'),('PP','Pragmatic Play',1,'','2026-11-09 14:47:25.000','2026-11-09 14:47:25.000'),('SPRIBE','Spribe',1,'','2026-11-09 14:47:24.000','2026-11-09 14:47:24.000'),('WG','WG',1,'','2026-11-09 17:21:57.000','2026-11-09 17:21:57.000');
/*!40000 ALTER TABLE `game_providers` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `game_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_results` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `game_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `outcome` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_cents` bigint NOT NULL DEFAULT '0',
  `reference` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_game_results_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `game_results` WRITE;
/*!40000 ALTER TABLE `game_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `game_results` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `game_wallet_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_wallet_transfers` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_cents` bigint NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_balance_cents` bigint NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_game_wallet_transfers_user` (`user_id`),
  KEY `idx_game_wallet_transfers_status` (`status`),
  KEY `idx_game_wallet_transfers_pending` (`user_id`,`direction`,`status`,`created_at`),
  CONSTRAINT `fk_game_wallet_transfers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `game_wallet_transfers` WRITE;
/*!40000 ALTER TABLE `game_wallet_transfers` DISABLE KEYS */;
/*!40000 ALTER TABLE `game_wallet_transfers` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` smallint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `kyc_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kyc_documents` (
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`user_id`,`kind`),
  CONSTRAINT `fk_kyc_documents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `kyc_documents` WRITE;
/*!40000 ALTER TABLE `kyc_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `kyc_documents` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `managed_games`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `managed_games` (
  `id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `normalized_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `thumbnail` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `category` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `game_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sort_order` int NOT NULL DEFAULT '0',
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `is_popular` tinyint(1) NOT NULL DEFAULT '0',
  `provider_status` int NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_managed_games_provider_external` (`provider_code`,`external_id`),
  UNIQUE KEY `uq_managed_games_normalized_name` (`normalized_name`),
  KEY `idx_managed_games_public` (`enabled`,`provider_code`,`sort_order`,`name`),
  CONSTRAINT `fk_managed_games_provider` FOREIGN KEY (`provider_code`) REFERENCES `game_providers` (`code`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `managed_games` WRITE;
/*!40000 ALTER TABLE `managed_games` DISABLE KEYS */;
INSERT INTO `managed_games` VALUES ('067d540d7ece7e7dfcfcadf11f25a71d','JDB','067d540d7ece7e7dfcfcadf11f25a71d','Dragon Tiger - Joker Bonus','dragontigerjokerbonus','','Mini Games','Card',1,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('09a138907ccf03d5c064c5ca71e9d9b3','INOUT','09a138907ccf03d5c064c5ca71e9d9b3','Jogo Do Bicho','jogodobicho','','Mini Games','Instant',6,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('101e3c281b35485001bec47561a0a03e','EZUGI','101e3c281b35485001bec47561a0a03e','Sic Bo','sicbo','','Mini Games','Casino Live',5,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('1189baca156e1bbbecc3b26651a63565','PG','1189baca156e1bbbecc3b26651a63565','Mahjong Ways','mahjongways','','Slots','Slot',1,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('13072a6eb2111c1b5202fe6155227e94','JDB','13072a6eb2111c1b5202fe6155227e94','Book Of Mystery','bookofmystery','','Slots','Slot',4,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('134bbc0f61b73824cf9a68411aa32dc6','INOUT','134bbc0f61b73824cf9a68411aa32dc6','Plinko Aztec','plinkoaztec','','Mini Games','Instant',3,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('16ed3068536a6bdae156e3d98bb9a365','PP','16ed3068536a6bdae156e3d98bb9a365','Wild West Gold','wildwestgold','','Slots','Slot',7,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('1c5a69caf9e2f1736eab4e7989f0ed0f','FACHAI','1c5a69caf9e2f1736eab4e7989f0ed0f','HOT POT PARTY','hotpotparty','','Slots','Slot',8,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:11.000'),('1d45e05527b049177d2f55aeb8a26e44','FACHAI','1d45e05527b049177d2f55aeb8a26e44','FORTUNE KOI','fortunekoi','','Slots','Slot',1,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('1d704bbb187a113229f3fdaa3b5406fe','JDB','1d704bbb187a113229f3fdaa3b5406fe','Prosperitytiger','prosperitytiger','','Slots','Slot',5,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('2126c5c458316ba1f2df65b387b60408','INOUT','2126c5c458316ba1f2df65b387b60408','Chicken Road','chickenroad','','Mini Games','Instant',1,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('26f9f76a8fc813b8abcb6b8cb03c2eab','EZUGI','26f9f76a8fc813b8abcb6b8cb03c2eab','Teen Patti 3 Card','teenpatti3card','','Mini Games','Casino Live',4,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('2fa9a84d096d6ff0bab53f81b79876c8','PG','2fa9a84d096d6ff0bab53f81b79876c8','Treasures of Aztec','treasuresofaztec','','Slots','Slot',3,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('327fa121c295ee87c7e2c60611d064bc','PP','327fa121c295ee87c7e2c60611d064bc','Big Bass Bonanza','bigbassbonanza','','Slots','Slot',6,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('3810e528e0abb8ce1cd7ddc2ece005c0','PG','3810e528e0abb8ce1cd7ddc2ece005c0','Double Fortune','doublefortune','','Slots','Slot',9,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('3a3affa176283107288f5da3698ffe7c','INOUT','3a3affa176283107288f5da3698ffe7c','Lucky mines','luckymines','','Mini Games','Instant',4,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('3c802c686f7f9270057b6bb69567ea98','INOUT','3c802c686f7f9270057b6bb69567ea98','SugarDaddy','sugardaddy','','Mini Games','Crash',10,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('3cf4a85cb6dcf4d8836c982c359cd72d','JL','3cf4a85cb6dcf4d8836c982c359cd72d','Jackpot Fishing','jackpotfishing','','Fishing','Fish',9,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('3d97f2073a05873b428be0ff20df724c','JDB','3d97f2073a05873b428be0ff20df724c','Wealthway','wealthway','','Slots','Slot',2,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('435b892a73bf466e0ad584d480e12143','EZUGI','435b892a73bf466e0ad584d480e12143','Andar Bahar','andarbahar','','Mini Games','Casino Live',3,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('46016a772b92c7f47dfdc5873f184ef1','JDB','46016a772b92c7f47dfdc5873f184ef1','Elemental Link Fire','elementallinkfire','','Slots','Slot',8,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('46816b28e0fbcf25d3e01c389510af70','FACHAI','46816b28e0fbcf25d3e01c389510af70','GODS GRANT FORTUNE','godsgrantfortune','','Fishing','Fish',5,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('490096198e28f770a3f85adb6ee49e0f','JL','490096198e28f770a3f85adb6ee49e0f','Golden Empire','goldenempire','','Slots','Slot',7,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('49b706ccfe7c53727ee6760cd9a8721a','JDB','49b706ccfe7c53727ee6760cd9a8721a','Fortune Neko','fortuneneko','','Slots','Slot',3,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('4ae52ed2e1a8c353878ba65ed7791ac4','PP','4ae52ed2e1a8c353878ba65ed7791ac4','Gates of Olympus 1000','gatesofolympus1000','','Slots','Slot',9,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('5c4a12fb0a9b296d9b0d5f9e1cd41d65','SPRIBE','5c4a12fb0a9b296d9b0d5f9e1cd41d65','Mines','mines','','Mini Games','Crash',2,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('600c338d3fca2da208f1bba2c9d29059','JDB','600c338d3fca2da208f1bba2c9d29059','Big Three Dragons','bigthreedragons','','Slots','Slot',9,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('60df04ad04885d74510d4c06e05919aa','FACHAI','60df04ad04885d74510d4c06e05919aa','GOLDEN PANTHER','goldenpanther','','Slots','Slot',4,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('6180fdaf4dfab4042194a7d595aca4bb','INOUT','6180fdaf4dfab4042194a7d595aca4bb','Hot-mines','hotmines','','Mini Games','Instant',5,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('66d311ff6cf531e40b61c483dd34c5c9','INOUT','66d311ff6cf531e40b61c483dd34c5c9','Penalty Unlimited','penaltyunlimited','','Mini Games','Instant',2,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('6940313357dd1ec127bb2203f9ae8e6c','FACHAI','6940313357dd1ec127bb2203f9ae8e6c','LUCKY FORTUNES','luckyfortunes','','Slots','Slot',10,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:11.000'),('6ab7a4fe5161936012d6b06143918223','SPRIBE','6ab7a4fe5161936012d6b06143918223','Plinko','plinko','','Mini Games','Crash',4,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('6aeb8420d03722cfd4b66d91e17758ba','PP','6aeb8420d03722cfd4b66d91e17758ba','Sugar Rush','sugarrush','','Slots','Slot',3,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('6db272c2a6aa2575012f60c23ed4917e','WG','6db272c2a6aa2575012f60c23ed4917e','Candy Party','candyparty','','Slots','Slot',8,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('6dcaf78e4e23929cbe2deb3d1210928c','PP','6dcaf78e4e23929cbe2deb3d1210928c','Sweet Bonanza','sweetbonanza','','Slots','Slot',2,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('74d2c49fa6db0aaa0f21f572e853977f','FACHAI','74d2c49fa6db0aaa0f21f572e853977f','GLORY OF ROME','gloryofrome','','Slots','Slot',9,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:11.000'),('7d65445a9da4bcd4cfbb28f9362c1da2','WG','7d65445a9da4bcd4cfbb28f9362c1da2','Lucky Dog','luckydog','','Slots','Slot',9,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('81c4999d70b1ebbb7cf89d8e41ad493c','INOUT','81c4999d70b1ebbb7cf89d8e41ad493c','Limbo','limbo','','Mini Games','Crash',7,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('82a810ba99a5fb3e23fc514afebd6314','PG','82a810ba99a5fb3e23fc514afebd6314','Caishen Wins','caishenwins','','Slots','Slot',8,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('8a87aae7a3624d284306e9c6fe1b3e9c','SPRIBE','8a87aae7a3624d284306e9c6fe1b3e9c','Dice','dice','','Mini Games','Crash',3,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('8c62471fd4e28c084a61811a3958f7a1','JL','8c62471fd4e28c084a61811a3958f7a1','Crazy777','crazy777','','Slots','Slot',5,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('8db4eb6d781f915eebab2a26133db0e9','PG','8db4eb6d781f915eebab2a26133db0e9','Fortune Ox','fortuneox','','Slots','Slot',4,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('9341a18d096ad901ef77338998f29098','JDB','9341a18d096ad901ef77338998f29098','Dragon Soar','dragonsoar','','Slots','Slot',10,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('936fd5c01f9802238494c026cac7345d','WG','936fd5c01f9802238494c026cac7345d','Dragon vs Tiger','dragonvstiger','','Slots','Slot',4,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('93e289d1b18a9f82fb5d790f3c8e6735','EZUGI','93e289d1b18a9f82fb5d790f3c8e6735','Cricket War','cricketwar','','Mini Games','Casino Live',10,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('93fe7c6e8ec4fba41eec4cc52aa03308','FACHAI','93fe7c6e8ec4fba41eec4cc52aa03308','FORTUNE EGG','fortuneegg','','Slots','Slot',6,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('95fc290bb05c07b5aad1a054eba4dcc4','PG','95fc290bb05c07b5aad1a054eba4dcc4','Wild Bandito','wildbandito','','Slots','Slot',7,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('981f5f9675002fbeaaf24c4128b938d7','JL','981f5f9675002fbeaaf24c4128b938d7','Boxing King','boxingking','','Slots','Slot',8,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('984615c9385c42b3dad0db4a9ef89070','JL','984615c9385c42b3dad0db4a9ef89070','Charge Buffalo','chargebuffalo','','Slots','Slot',6,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('9951f259f97eb5202a590284848e4592','FACHAI','9951f259f97eb5202a590284848e4592','WIN WIN NEKO','winwinneko','','Slots','Slot',7,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('9a8482565ce343ad3ea7fc4bc42cb043','PG','9a8482565ce343ad3ea7fc4bc42cb043','Fortune Tiger','fortunetiger','','Slots','Slot',5,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('9afa884f169dfd11a5cd39da32bd4df1','PP','9afa884f169dfd11a5cd39da32bd4df1','Gates of Olympus','gatesofolympus','','Slots','Slot',1,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('9dc7ac6155c5a19c1cc204853e426367','SPRIBE','9dc7ac6155c5a19c1cc204853e426367','Mini Roulette','miniroulette','','Mini Games','Crash',8,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('a04d1f3eb8ccec8a4823bdf18e3f0e84','SPRIBE','a04d1f3eb8ccec8a4823bdf18e3f0e84','Aviator','aviator','','Mini Games','Crash',1,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('a1883de50bf3af6e91853c455f327d83','JL','a1883de50bf3af6e91853c455f327d83','Fortune Skull 500','fortuneskull500','','Slots','Slot',1,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('a22b176d06364fdc62cb8f05318a0e80','WG','a22b176d06364fdc62cb8f05318a0e80','Black Myth: Wukong','blackmythwukong','','Slots','Slot',5,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('a51b03beafa1773484d1e9c866709589','INOUT','a51b03beafa1773484d1e9c866709589','Tower','tower','','Mini Games','Instant',11,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:10.000'),('a669c993b0e1f1b7da100fcf95516bdf','SPRIBE','a669c993b0e1f1b7da100fcf95516bdf','Hi Lo','hilo','','Mini Games','Crash',6,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('a990de177577a2e6a889aaac5f57b429','JL','a990de177577a2e6a889aaac5f57b429','Fortune Gems','fortunegems','','Slots','Slot',3,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('b1fc7b189ba6f2ccf74e8bcf4b55a686','PP','b1fc7b189ba6f2ccf74e8bcf4b55a686','Mahjong Wins','mahjongwins','','Slots','Slot',8,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('b31720b3cd65d917a1a96ef61a72b672','SPRIBE','b31720b3cd65d917a1a96ef61a72b672','Hotline','hotline','','Mini Games','Crash',9,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('b5c8e49fdd80b57de6da0e234b1bd683','EZUGI','b5c8e49fdd80b57de6da0e234b1bd683','Speed Roulette','speedroulette','','Mini Games','Casino Live',7,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('b7385424b2c19a46cbcece0c8dfb0080','EZUGI','b7385424b2c19a46cbcece0c8dfb0080','Ultimate Roulette','ultimateroulette','','Mini Games','Casino Live',6,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('ba2adf72179e1ead9e3dae8f0a7d4c07','PG','ba2adf72179e1ead9e3dae8f0a7d4c07','Mahjong Ways 2','mahjongways2','','Slots','Slot',2,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('bc681b9e1d028b3e025bc247a6b02abd','WG','bc681b9e1d028b3e025bc247a6b02abd','Fortune Snake','fortunesnake','','Slots','Slot',2,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('bdfb23c974a2517198c5443adeea77a8','JL','bdfb23c974a2517198c5443adeea77a8','Super Ace','superace','','Slots','Slot',2,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('be6b6890587ed84289fad941d99a3613','PP','be6b6890587ed84289fad941d99a3613','Starlight Princess','starlightprincess','','Slots','Slot',4,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('c182b3e577b60ec8d4e411bcbca3f81d','PP','c182b3e577b60ec8d4e411bcbca3f81d','The Dog House','thedoghouse','','Slots','Slot',5,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('c311eb4bbba03b105d150504931f2479','SPRIBE','c311eb4bbba03b105d150504931f2479','Keno','keno','','Mini Games','Crash',7,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('c68a515f0b3b10eec96cf6d33299f4e2','SPRIBE','c68a515f0b3b10eec96cf6d33299f4e2','Goal','goal','','Mini Games','Crash',5,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('c7fff23ec228dc9c4797c33da38bee61','WG','c7fff23ec228dc9c4797c33da38bee61','Treasure Bowl','treasurebowl','','Slots','Slot',10,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('c845960c81d27d7880a636424e53964d','JL','c845960c81d27d7880a636424e53964d','Hot Chilli','hotchilli','','Slots','Slot',10,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('c88c40ec4fc544518d938315e2d1b2a3','EZUGI','c88c40ec4fc544518d938315e2d1b2a3','Lucky 7','lucky7','','Mini Games','Casino Live',8,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('caacafe3f64a6279e10a378ede09ff38','JL','caacafe3f64a6279e10a378ede09ff38','Mega Fishing','megafishing','','Fishing','Fish',14,1,1,0,'2026-11-09 18:02:10.000','2026-11-09 18:02:10.000'),('cb66d23b547498132598589af324d558','INOUT','cb66d23b547498132598589af324d558','AviaFly','aviafly','','Mini Games','Crash',8,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('cdb5af91d46d4c36fa18c0b49d5b2e1d','WG','cdb5af91d46d4c36fa18c0b49d5b2e1d','Fortune Rabbit','fortunerabbit','','Slots','Slot',1,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('d0da5b10b559870bb66561ccbcec65a4','WG','d0da5b10b559870bb66561ccbcec65a4','Fortune Horse','fortunehorse','','Slots','Slot',3,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('d4dbbc3db3771ff9aed18118be8fb6ee','WG','d4dbbc3db3771ff9aed18118be8fb6ee','Duo Bao','duobao','','Slots','Slot',7,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('d60a3de76746e30959ee740e3780e7e1','EZUGI','d60a3de76746e30959ee740e3780e7e1','EZ Baccarat','ezbaccarat','','Mini Games','Casino Live',9,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('da0d973cee506257c900d18375883f2c','FACHAI','da0d973cee506257c900d18375883f2c','ZEUS','zeus','','Slots','Slot',3,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('db1e883235e94cda2254f578cec5f73a','WG','db1e883235e94cda2254f578cec5f73a','Water Margin','watermargin','','Slots','Slot',6,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:11.000'),('db249defce63610fccabfa829a405232','JL','db249defce63610fccabfa829a405232','Money Coming','moneycoming','','Slots','Slot',4,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('de88f202c5a8beeaccabbd944f8acfbf','SPRIBE','de88f202c5a8beeaccabbd944f8acfbf','Balloon','balloon','','Mini Games','Crash',10,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('e1b4c6b95746d519228744771f15fe4b','PG','e1b4c6b95746d519228744771f15fe4b','Lucky Neko','luckyneko','','Slots','Slot',6,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('e270f0674dff538b181499d18ab47845','JDB','e270f0674dff538b181499d18ab47845','Mjolnir','mjolnir','','Slots','Slot',7,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('e333695bcff28acdbecc641ae6ee2b23','JL','e333695bcff28acdbecc641ae6ee2b23','Bombing Fishing','bombingfishing','','Fishing','Fish',12,1,1,0,'2026-11-09 18:02:10.000','2026-11-09 18:02:10.000'),('e3f45e2f03388056aba660b7e737ecf0','PP','e3f45e2f03388056aba660b7e737ecf0','Sweet Bonanza 1000','sweetbonanza1000','','Slots','Slot',10,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('e5a2c89d257b68a1c2855e00e76bc934','FACHAI','e5a2c89d257b68a1c2855e00e76bc934','CRAZY BUFFALO','crazybuffalo','','Slots','Slot',2,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('e705514fdd4f9bea5f82bbd0b2c0a353','JDB','e705514fdd4f9bea5f82bbd0b2c0a353','Miner Babe','minerbabe','','Slots','Slot',6,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('e794bf5717aca371152df192341fe68b','JL','e794bf5717aca371152df192341fe68b','Royal Fishing','royalfishing','','Fishing','Fish',11,1,1,0,'2026-11-09 18:02:10.000','2026-11-09 18:02:10.000'),('e9f92f6edc2dac2d08bc345ee036260c','PG','e9f92f6edc2dac2d08bc345ee036260c','Battleground Royale','battlegroundroyale','','Slots','Slot',10,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('eef3e28f0e3e7b72cbca61e7924d00f1','JL','eef3e28f0e3e7b72cbca61e7924d00f1','Dinosaur Tycoon','dinosaurtycoon','','Fishing','Fish',13,1,1,0,'2026-11-09 18:02:10.000','2026-11-09 18:02:10.000'),('efb14d01f5ec68e1cf49c53f30c4d476','INOUT','efb14d01f5ec68e1cf49c53f30c4d476','Rabbit Road','rabbitroad','','Mini Games','Instant',12,1,1,0,'2026-11-09 17:21:57.000','2026-11-09 18:02:10.000'),('efdb52994fbfe97efcbd878dbd697ebb','EZUGI','efdb52994fbfe97efcbd878dbd697ebb','Dragon Tiger','dragontiger','','Mini Games','Casino Live',1,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000'),('f84949bd783c7395b5f3092f4d4ec600','INOUT','f84949bd783c7395b5f3092f4d4ec600','Bubbles','bubbles','','Mini Games','Instant',9,1,1,0,'2026-11-09 14:47:24.000','2026-11-09 18:02:10.000'),('f84c5ce9ae53fac2e7afa9f8157e453c','EZUGI','f84c5ce9ae53fac2e7afa9f8157e453c','Dragon Tiger da Sorte','dragontigerdasorte','','Mini Games','Casino Live',2,1,1,0,'2026-11-09 14:47:25.000','2026-11-09 18:02:10.000');
/*!40000 ALTER TABLE `managed_games` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000001_create_cache_table',1),(2,'0001_01_01_000002_create_jobs_table',1),(3,'2026_11_09_000100_create_users_table',1),(4,'2026_11_09_000200_create_wallet_tables',1),(5,'2026_11_09_000300_create_identity_tables',1),(6,'2026_11_09_000400_create_communication_tables',1),(7,'2026_11_09_000500_create_platform_tables',1),(8,'2026_11_09_000600_create_game_tables',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `related_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_created` (`user_id`,`created_at`,`id`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otps` (
  `channel` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `destination` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` bigint NOT NULL,
  PRIMARY KEY (`channel`,`destination`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `otps` WRITE;
/*!40000 ALTER TABLE `otps` DISABLE KEYS */;
/*!40000 ALTER TABLE `otps` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `platform_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_settings` (
  `id` tinyint unsigned NOT NULL,
  `announcement` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `maintenance_mode` tinyint(1) NOT NULL DEFAULT '0',
  `support_email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `support_phone` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `support_hours` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `promotions` longtext COLLATE utf8mb4_unicode_ci,
  `homepage_banner` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `platform_settings` WRITE;
/*!40000 ALTER TABLE `platform_settings` DISABLE KEYS */;
INSERT INTO `platform_settings` VALUES (1,'',0,'','','','[]','{}');
/*!40000 ALTER TABLE `platform_settings` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `support_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_tickets` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `subject` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `reply` varchar(3000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_support_tickets_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `support_tickets` WRITE;
/*!40000 ALTER TABLE `support_tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_tickets` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_cents` bigint NOT NULL DEFAULT '0',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `payment_reference` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `payment_note` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `proof_file` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `game_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime(3) NOT NULL,
  `processed_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_transactions_user` (`user_id`),
  KEY `idx_transactions_status` (`status`),
  KEY `idx_transactions_type` (`type`),
  CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `country` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `balance_cents` bigint NOT NULL DEFAULT '0',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `phone_verified` tinyint(1) NOT NULL DEFAULT '0',
  `kyc_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_submitted',
  `full_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `date_of_birth` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `document_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `document_number` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `google_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `google_picture_url` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `avatar_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime(3) NOT NULL,
  `last_login_at` datetime(3) DEFAULT NULL,
  `kyc_reviewed_at` datetime(3) DEFAULT NULL,
  `kyc_review_note` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `failed_admin_attempts` int NOT NULL DEFAULT '0',
  `locked_until` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_username_lower` ((lower(`username`))),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('f7555cd5-889d-4944-b26b-38d627a715b0','admin','','','','$2b$12$St6k5UWCd4iQRaEZKXnyGuw2XdZsr/copnI6cOP4/DpwEhNcXoCKO','admin',0,'active',0,0,'not_submitted','','','','','','','','','2026-11-09 10:17:26.772',NULL,NULL,'',0,0);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verifications` (
  `channel` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `destination` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `verified` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`channel`,`destination`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `verifications` WRITE;
/*!40000 ALTER TABLE `verifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `verifications` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `wallet_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallet_ledger` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_cents` bigint NOT NULL,
  `balance_after_cents` bigint NOT NULL,
  `reference_type` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idempotency_key` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `reference` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wallet_ledger_idempotency` (`idempotency_key`),
  KEY `idx_wallet_ledger_user` (`user_id`),
  KEY `idx_wallet_ledger_reference` (`reference_id`),
  CONSTRAINT `fk_wallet_ledger_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `wallet_ledger` WRITE;
/*!40000 ALTER TABLE `wallet_ledger` DISABLE KEYS */;
/*!40000 ALTER TABLE `wallet_ledger` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

