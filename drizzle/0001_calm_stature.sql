CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationId` int NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`shippingCost` decimal(12,2) NOT NULL DEFAULT '0',
	`tax` decimal(12,2) NOT NULL DEFAULT '0',
	`lineItems` json NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'NGN',
	`dueDate` date NOT NULL,
	`paymentInstructions` text,
	`status` enum('sent','paid','overdue') NOT NULL DEFAULT 'sent',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteRequestId` int NOT NULL,
	`senderId` int NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(80) NOT NULL,
	`refId` varchar(120),
	`title` varchar(180) NOT NULL,
	`body` text,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderStatusHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`status` varchar(30) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orderStatusHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`status` enum('processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'processing',
	`trackingNumber` varchar(120),
	`carrier` varchar(80),
	`shippingDetails` text,
	`shippedAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`provider` enum('flutterwave','stripe','bank_transfer') NOT NULL,
	`providerReference` varchar(160),
	`transactionId` varchar(160),
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(8) NOT NULL,
	`method` varchar(40),
	`status` enum('pending','successful','failed') NOT NULL DEFAULT 'pending',
	`rawPayload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(220) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(80) NOT NULL,
	`moq` int NOT NULL,
	`colors` json NOT NULL,
	`sizes` json NOT NULL,
	`packagingOptions` json NOT NULL,
	`customizationOptions` json NOT NULL,
	`images` json,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteRequestId` int NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'NGN',
	`subtotal` decimal(12,2) NOT NULL,
	`notes` text,
	`issuedBy` int NOT NULL,
	`status` enum('sent','accepted','declined','expired') NOT NULL DEFAULT 'sent',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quoteRequestItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteRequestId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`color` varchar(50) NOT NULL,
	`size` varchar(30) NOT NULL,
	`packaging` varchar(120) NOT NULL,
	`customization` varchar(160) NOT NULL,
	CONSTRAINT `quoteRequestItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quoteRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(32) NOT NULL,
	`customerId` int NOT NULL,
	`status` enum('draft','pending','quoted','accepted','declined','rejected','expired','invoiced','overdue','paid','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`adminNotes` text,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quoteRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `quoteRequests_ref_unique` UNIQUE(`ref`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `companyName` varchar(200);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(40);--> statement-breakpoint
ALTER TABLE `users` ADD `whatsapp` varchar(40);