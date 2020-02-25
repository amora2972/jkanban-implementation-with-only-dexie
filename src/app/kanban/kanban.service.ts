import {Injectable} from '@angular/core';
import {kanbanDb} from './kanbandb';
import {IColumn} from './interfaces/column.interface';
import {ITicket} from './interfaces/ticket.interface';

@Injectable({
  providedIn: 'root'
})

// service for indexed db using the dexie library
export class KanbanService {
  limitOfTickets = 2;

  /**
   * @returns all columns with their tickets from indexed db
   */
  async fetchColumns(): Promise<IColumn[]> {
    const columns: IColumn[] = await kanbanDb.columns.toArray();

    return Promise.all(columns.map(async (col: IColumn) => {
      const table = kanbanDb.tickets;
      const collection = table
        .where('columnId').anyOf(+col.id);
      const ORDER_BY = 'order';

      const primaryKeySet = new Set(await collection.primaryKeys());

      const pageKeys = [];
      await table.orderBy(ORDER_BY)
        .until(() => pageKeys.length === this.limitOfTickets)
        .eachPrimaryKey(id => {
          if (primaryKeySet.has(id)) {
            pageKeys.push(id);
          }
        });

      col.item = await Promise.all(pageKeys.map(id => table.get(id)));
      col.totalTicketsLeft = await collection.count() - col.item.length;

      return col;
    })).then((cols: IColumn[]) => cols);
  }

  /**
   *
   * @param columnId the column id to be assert
   * @param offset how many tickets are already in the view
   */
  async fetchColumnWithTickets(columnId: number, offset: number): Promise<IColumn> {
    const column: IColumn = await kanbanDb.columns.get(columnId);

    const table = kanbanDb.tickets;
    const collection = table
      .where('columnId').anyOf(columnId);

    column.item = await table
      .where('order').above(offset - 1).and((item: ITicket) => +item.columnId === columnId).limit(this.limitOfTickets).sortBy('order');
    column.totalTicketsLeft = await collection.count() - (offset + column.item.length);
    return column;
  }

  /**
   *
   * @param id of the ticket.
   * @returns the corresponding ticket of the given id from indexed db
   */
  async fetchTicket(id: any): Promise<ITicket> {
    return await kanbanDb.tickets.get(+id);
  }

  /**
   * stores a given ticket in indexed db
   * @param ticket to be stored
   */
  async storeTicket(ticket: ITicket): Promise<ITicket> {
    const ticketId = await kanbanDb.tickets.add(ticket);
    return (await this.fetchTicket(ticketId));
  }

  /**
   *
   * updates a specific ticket in indexed db
   * @param ticket to be updated
   * @returns the updated ticket from indexed db
   */
  async updateTicket(ticket: ITicket): Promise<ITicket> {
    ticket.id = +ticket.id;
    const isUpdated = await kanbanDb.tickets.update(ticket.id, ticket);
    return (await this.fetchTicket(ticket.id));
  }

  /**
   *
   * delete an element based on the given id from indexed db
   * @param id of the element to be destroyed
   */
  async destroyElement(id: number): Promise<number> {
    const isDestroyed = (await kanbanDb.tickets.where('id').anyOf(+id).delete());
    return id;
  }

  /**
   *
   * this method will make a batch update which will update
   * all the elements in the received tickets array
   * @param tickets array of elemnets to be updated
   */
  async batchUpdate(tickets: ITicket[]) {
    await kanbanDb.tickets.bulkPut(tickets);
    return tickets;
  }

  /**
   *
   * this method will change the order by incrementing by one after a specified index
   * @param columnId the id of the column to regenerate the order of
   * @param ticket the ticket which the re-ordering will start from
   */
  async regenerateByIncrement(columnId: number, ticket: ITicket) {
    const table = kanbanDb.tickets;
    const collection = await table.where('order').aboveOrEqual(ticket.order).and(item => item.columnId === columnId).sortBy('order');

    const tickets = [];
    collection.forEach((item: ITicket, index: number) => {
      if (+item.id !== +ticket.id) {
        item = this.prepareForUpdate(item);
        if (item.order === ticket.order) {
          item.order += 1;
        } else {
          item.order = ticket.order + index;
        }
        tickets.push(item);
      }
    });
    this.batchUpdate(tickets);
  }


  /**
   * this method will change the order by decrementing by one after a specified index
   * @param columnId the id of the column to regenerate the order of
   * @param ticket he ticket which the re-ordering will start from
   */
  async regenerateByDecrement(columnId: number, ticket: ITicket) {
    const table = kanbanDb.tickets;
    const collection = await table.where('columnId').anyOf(columnId).and(item => item.order > ticket.order).sortBy('order');
    const tickets = [];

    collection.forEach((item: ITicket, index: number) => {
      if (+item.id !== +ticket.id) {
        item = this.prepareForUpdate(item);
        item.order -= 1;
        tickets.push(item);
      }
    });
    this.batchUpdate(tickets);
  }

  /**
   *
   * @param ticket to be prepared
   */
  prepareForUpdate(ticket: ITicket) {
    ticket.id = +ticket.id;
    ticket.columnId = +ticket.columnId;
    ticket.title = ticket.originalTitle;
    delete ticket.originalTitle;
    return ticket;
  }
}
