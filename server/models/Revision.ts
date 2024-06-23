import {
  InferAttributes,
  InferCreationAttributes,
  Op,
  SaveOptions,
} from "sequelize";
import {
  DataType,
  BelongsTo,
  Column,
  DefaultScope,
  ForeignKey,
  Table,
  IsNumeric,
  Length as SimpleLength,
} from "sequelize-typescript";
import type { ProsemirrorData } from "@shared/types";
import { DocumentValidation } from "@shared/validations";
import Document from "./Document";
import User from "./User";
import IdModel from "./base/IdModel";
import Fix from "./decorators/Fix";
import IsHexColor from "./validators/IsHexColor";
import Length from "./validators/Length";

@DefaultScope(() => ({
  include: [
    {
      model: User,
      as: "user",
      paranoid: false,
    },
  ],
}))
@Table({ tableName: "revisions", modelName: "revision" })
@Fix
class Revision extends IdModel<
  InferAttributes<Revision>,
  Partial<InferCreationAttributes<Revision>>
> {
  @IsNumeric
  @Column(DataType.SMALLINT)
  version?: number | null;

  @SimpleLength({
    max: 255,
    msg: `editorVersion must be 255 characters or less`,
  })
  @Column
  editorVersion: string;

  @Length({
    max: DocumentValidation.maxTitleLength,
    msg: `Revision title must be ${DocumentValidation.maxTitleLength} characters or less`,
  })
  @Column
  title: string;

  /**
   * The content of the revision as Markdown.
   *
   * @deprecated Use `content` instead, or `DocumentHelper.toMarkdown` if exporting lossy markdown.
   * This column will be removed in a future migration.
   */
  @Column(DataType.TEXT)
  text: string;

  /**
   * The content of the revision as JSON.
   */
  @Column(DataType.JSONB)
  content: ProsemirrorData;

  /**
   * An emoji to use as the document icon,
   * This is used as fallback (for backward compat) when icon is not set.
   */
  @Length({
    max: 50,
    msg: `Emoji must be 50 characters or less`,
  })
  @Column
  emoji: string | null;

  /** An icon to use as the document icon. */
  @Length({
    max: 50,
    msg: `icon must be 50 characters or less`,
  })
  @Column
  icon: string | null;

  /** The color of the icon. */
  @IsHexColor
  @Column
  color: string | null;

  // associations

  @BelongsTo(() => Document, "documentId")
  document: Document;

  @ForeignKey(() => Document)
  @Column(DataType.UUID)
  documentId: string;

  @BelongsTo(() => User, "userId")
  user: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId: string;

  // static methods

  /**
   * Find the latest revision for a given document
   *
   * @param documentId The document id to find the latest revision for
   * @returns A Promise that resolves to a Revision model
   */
  static findLatest(documentId: string) {
    return this.findOne({
      where: {
        documentId,
      },
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Build a Revision model from a Document model
   *
   * @param document The document to build from
   * @returns A Revision model
   */
  static buildFromDocument(document: Document) {
    return this.build({
      title: document.title,
      text: document.text,
      emoji: document.emoji,
      icon: document.icon,
      color: document.color,
      content: document.content,
      userId: document.lastModifiedById,
      editorVersion: document.editorVersion,
      version: document.version,
      documentId: document.id,
      // revision time is set to the last time document was touched as this
      // handler can be debounced in the case of an update
      createdAt: document.updatedAt,
    });
  }

  /**
   * Create a Revision model from a Document model and save it to the database
   *
   * @param document The document to create from
   * @param options Options passed to the save method
   * @returns A Promise that resolves when saved
   */
  static createFromDocument(
    document: Document,
    options?: SaveOptions<InferAttributes<Revision>>
  ) {
    const revision = this.buildFromDocument(document);
    return revision.save(options);
  }

  // instance methods

  /**
   * Find the revision for the document before this one.
   *
   * @returns A Promise that resolves to a Revision, or null if this is the first revision.
   */
  before(): Promise<Revision | null> {
    return (this.constructor as typeof Revision).findOne({
      where: {
        documentId: this.documentId,
        createdAt: {
          [Op.lt]: this.createdAt,
        },
      },
      order: [["createdAt", "DESC"]],
    });
  }
}

export default Revision;
